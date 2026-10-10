import Foundation

extension Error {
    var isCancellation: Bool {
        if self is CancellationError {
            return true
        }

        if let urlError = self as? URLError, urlError.code == .cancelled {
            return true
        }

        let nsError = self as NSError
        if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled {
            return true
        }

        if case .networkError(let underlying)? = self as? APIError {
            return underlying.isCancellation
        }

        return false
    }

    var isTransientTransportFailure: Bool {
        let code: URLError.Code
        if let urlError = self as? URLError {
            code = urlError.code
        } else if case .networkError(let underlying)? = self as? APIError {
            return underlying.isTransientTransportFailure
        } else {
            let nsError = self as NSError
            guard nsError.domain == NSURLErrorDomain else { return false }
            code = URLError.Code(rawValue: nsError.code)
        }

        switch code {
        case .timedOut,
             .cannotFindHost,
             .cannotConnectToHost,
             .networkConnectionLost,
             .dnsLookupFailed,
             .notConnectedToInternet,
             .internationalRoamingOff,
             .dataNotAllowed:
            return true
        default:
            return false
        }
    }

    var transportLogMetadata: [String: CustomStringConvertible] {
        if case .networkError(let underlying)? = self as? APIError {
            return underlying.transportLogMetadata
        }

        let nsError = self as NSError
        var metadata: [String: CustomStringConvertible] = [
            "errorDomain": nsError.domain,
            "errorCode": nsError.code,
        ]
        if let urlError = self as? URLError {
            metadata["urlErrorCode"] = urlError.code.rawValue
        }
        return metadata
    }
}
