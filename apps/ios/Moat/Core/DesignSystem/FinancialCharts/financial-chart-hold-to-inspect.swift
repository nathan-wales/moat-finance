import SwiftUI
import UIKit

struct FinancialChartHoldToInspectOverlay: View {
    var onInspect: (CGPoint) -> Void
    var onEnd: () -> Void

    var body: some View {
        HoldToInspectRepresentable(onInspect: onInspect, onEnd: onEnd)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
    }
}

private struct HoldToInspectRepresentable: UIViewRepresentable {
    var onInspect: (CGPoint) -> Void
    var onEnd: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onInspect: onInspect, onEnd: onEnd)
    }

    func makeUIView(context: Context) -> UIView {
        let view = HoldToInspectHostView()
        let recognizer = FinancialChartHoldToInspectRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handle(_:))
        )
        recognizer.delegate = context.coordinator
        view.addGestureRecognizer(recognizer)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.onInspect = onInspect
        context.coordinator.onEnd = onEnd
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onInspect: (CGPoint) -> Void
        var onEnd: () -> Void
        private var didActivateInspection = false

        init(onInspect: @escaping (CGPoint) -> Void, onEnd: @escaping () -> Void) {
            self.onInspect = onInspect
            self.onEnd = onEnd
        }

        @objc func handle(_ recognizer: UIGestureRecognizer) {
            switch recognizer.state {
            case .began, .changed:
                didActivateInspection = true
                onInspect(recognizer.location(in: recognizer.view))
            case .ended, .cancelled, .failed:
                finishInspectionIfNeeded()
            default:
                break
            }
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            guard let recognizer = gestureRecognizer as? FinancialChartHoldToInspectRecognizer else {
                return false
            }
            if recognizer.isInspecting {
                return false
            }
            return otherGestureRecognizer is UIPanGestureRecognizer
        }

        private func finishInspectionIfNeeded() {
            guard didActivateInspection else { return }
            didActivateInspection = false
            onEnd()
        }
    }
}

private final class HoldToInspectHostView: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isMultipleTouchEnabled = false
        isAccessibilityElement = false
        accessibilityElementsHidden = true
        isUserInteractionEnabled = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.contains(point)
    }
}

private final class LockedScrollView {
    weak var scrollView: UIScrollView?
    let wasScrollEnabled: Bool
    let wasPanEnabled: Bool

    init(scrollView: UIScrollView) {
        self.scrollView = scrollView
        wasScrollEnabled = scrollView.isScrollEnabled
        wasPanEnabled = scrollView.panGestureRecognizer.isEnabled
    }

    func lock() {
        scrollView?.isScrollEnabled = false
        scrollView?.panGestureRecognizer.isEnabled = false
    }

    func unlock() {
        scrollView?.isScrollEnabled = wasScrollEnabled
        scrollView?.panGestureRecognizer.isEnabled = wasPanEnabled
    }
}

private final class FinancialChartHoldToInspectRecognizer: UIGestureRecognizer {
    private var controller = FinancialChartInspectionController()
    private var trackingTouch: UITouch?
    private var lockedScrollViews: [LockedScrollView] = []

    var isInspecting: Bool {
        controller.isInspecting
    }

    override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
    }

    deinit {
        cancelActivationWork()
        unlockEnclosingScrollViews()
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        if trackingTouch != nil {
            if !controller.isInspecting {
                failHold()
            }
            return
        }

        guard let touch = touches.first, touches.count == 1 else {
            failHold()
            return
        }

        trackingTouch = touch
        controller.touchBegan(at: touch.location(in: view))
        scheduleActivation()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackingTouch, touches.contains(touch) else { return }

        switch controller.touchMoved(to: touch.location(in: view)) {
        case .ignore:
            break
        case .cancelHold:
            failHold()
        case .updateInspection:
            state = .changed
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackingTouch, touches.contains(touch) else { return }
        cancelActivationWork()

        if controller.isInspecting {
            controller.touchEnded()
            state = .ended
        } else {
            failHold()
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackingTouch, touches.contains(touch) else { return }
        cancelActivationWork()
        let wasInspecting = controller.isInspecting
        controller.touchCancelled()
        state = wasInspecting ? .cancelled : .failed
    }

    override func reset() {
        cancelActivationWork()
        controller.touchCancelled()
        unlockEnclosingScrollViews()
        trackingTouch = nil
        super.reset()
    }

    override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool {
        controller.isInspecting && preventedGestureRecognizer is UIPanGestureRecognizer
    }

    override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool {
        !controller.isInspecting
    }

    @objc private func activateIfWaiting() {
        guard state == .possible, controller.holdDurationElapsed() else { return }
        FinancialChartHaptics.prepare()
        lockEnclosingScrollViews()
        state = .began
    }

    private func scheduleActivation() {
        cancelActivationWork()
        perform(#selector(activateIfWaiting), with: nil, afterDelay: controller.holdDuration)
    }

    private func failHold() {
        cancelActivationWork()
        controller.touchCancelled()
        if state == .possible {
            state = .failed
        }
    }

    private func cancelActivationWork() {
        NSObject.cancelPreviousPerformRequests(
            withTarget: self,
            selector: #selector(activateIfWaiting),
            object: nil
        )
    }

    private func lockEnclosingScrollViews() {
        var current = view?.superview
        while let node = current {
            if let scrollView = node as? UIScrollView {
                let locked = LockedScrollView(scrollView: scrollView)
                locked.lock()
                lockedScrollViews.append(locked)
            }
            current = node.superview
        }
    }

    private func unlockEnclosingScrollViews() {
        for locked in lockedScrollViews {
            locked.unlock()
        }
        lockedScrollViews.removeAll()
    }
}
