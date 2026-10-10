import CoreLocation
import MapKit
import SwiftUI

struct MileageMapRoute: Identifiable {
    let id: String
    let segments: [[CLLocationCoordinate2D]]
}

struct MileageRouteMapView: UIViewRepresentable {
    var routes: [MileageMapRoute]
    var selectedRouteId: String?
    var onSelectRoute: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelectRoute: onSelectRoute)
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.pointOfInterestFilter = .excludingAll
        mapView.isRotateEnabled = false
        mapView.showsUserLocation = false
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        mapView.addGestureRecognizer(tap)
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.onSelectRoute = onSelectRoute
        mapView.removeOverlays(mapView.overlays)
        var boundingRect: MKMapRect = .null
        for route in routes {
            for (index, segment) in route.segments.enumerated() {
                guard segment.count >= 2 else { continue }
                var coordinates = segment
                let polyline = IdentifiedMileagePolyline(coordinates: &coordinates, count: coordinates.count)
                polyline.tripId = route.id
                polyline.segmentIndex = index
                polyline.isSelected = route.id == selectedRouteId
                mapView.addOverlay(polyline)
                boundingRect = boundingRect.union(polyline.boundingMapRect)
            }
        }

        let signature = routes.map { route in
            "\(route.id):\(route.segments.map(\.count).reduce(0, +))"
        }.joined(separator: "|")
        let shouldFitCamera = context.coordinator.fittedSignature != signature
        context.coordinator.fittedSignature = signature
        if shouldFitCamera, boundingRect.isNull == false, boundingRect.size.width > 0, boundingRect.size.height > 0 {
            mapView.setVisibleMapRect(
                boundingRect.insetBy(dx: boundingRect.size.width * -0.2, dy: boundingRect.size.height * -0.2),
                animated: false
            )
        }
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var onSelectRoute: ((String) -> Void)?
        var fittedSignature = ""

        init(onSelectRoute: ((String) -> Void)?) {
            self.onSelectRoute = onSelectRoute
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let polyline = overlay as? IdentifiedMileagePolyline else {
                return MKOverlayRenderer(overlay: overlay)
            }
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor(polyline.isSelected ? MoatTheme.ColorToken.accentStrong : MoatTheme.ColorToken.accent)
            renderer.lineWidth = polyline.isSelected ? 5 : 3
            renderer.lineJoin = .round
            renderer.lineCap = .round
            return renderer
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            mapView.deselectAnnotation(view.annotation, animated: false)
        }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let mapView = gesture.view as? MKMapView else { return }
            let point = gesture.location(in: mapView)
            var closest: (id: String, distance: CGFloat)?
            for overlay in mapView.overlays {
                guard let polyline = overlay as? IdentifiedMileagePolyline else { continue }
                let mapPoints = polyline.points()
                let count = polyline.pointCount
                guard count > 0 else { continue }
                for index in 0 ..< count {
                    let screen = mapView.convert(mapPoints[index].coordinate, toPointTo: mapView)
                    if index == 0 {
                        let distance = hypot(screen.x - point.x, screen.y - point.y)
                        if closest == nil || distance < (closest?.distance ?? .greatestFiniteMagnitude) {
                            closest = (polyline.tripId, distance)
                        }
                        continue
                    }
                    let previous = mapView.convert(mapPoints[index - 1].coordinate, toPointTo: mapView)
                    let distance = distanceFrom(point, start: previous, end: screen)
                    if closest == nil || distance < (closest?.distance ?? .greatestFiniteMagnitude) {
                        closest = (polyline.tripId, distance)
                    }
                }
            }
            if let closest, closest.distance < 28 {
                onSelectRoute?(closest.id)
            }
        }

        private func distanceFrom(_ point: CGPoint, start: CGPoint, end: CGPoint) -> CGFloat {
            let dx = end.x - start.x
            let dy = end.y - start.y
            let lengthSquared = dx * dx + dy * dy
            if lengthSquared < 1 {
                return hypot(point.x - start.x, point.y - start.y)
            }
            let t = min(max(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0), 1)
            let projected = CGPoint(x: start.x + t * dx, y: start.y + t * dy)
            return hypot(point.x - projected.x, point.y - projected.y)
        }
    }
}

final class IdentifiedMileagePolyline: MKPolyline {
    var tripId = ""
    var segmentIndex = 0
    var isSelected = false
}

extension MileageTrip {
    var mapRoute: MileageMapRoute {
        MileageMapRoute(
            id: id,
            segments: encodedPolylines.map { MileagePolyline.decode($0) }.filter { $0.count >= 2 }
        )
    }
}
