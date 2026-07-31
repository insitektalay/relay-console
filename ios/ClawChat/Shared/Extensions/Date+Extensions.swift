// Date+Extensions.swift
// ClawChat

import Foundation

extension Date {
    /// Smart chat-list timestamp: "Just now", "2m", "14:32", "Mon", "12 Jan"
    var chatTimestamp: String {
        let now = Date()
        let secondsAgo = now.timeIntervalSince(self)

        if secondsAgo < 60 {
            return "Just now"
        } else if secondsAgo < 3_600 {
            let minutes = Int(secondsAgo / 60)
            return "\(minutes)m"
        } else if isToday {
            return timeOnly
        } else if isYesterday {
            return "Yesterday"
        } else if isThisWeek {
            return DateFormatter.clawWeekdayShort.string(from: self)
        } else {
            return DateFormatter.clawDayMonthShort.string(from: self)
        }
    }

    /// Full human-readable timestamp: "12 Jan 2025, 14:32"
    var fullTimestamp: String {
        DateFormatter.clawFullTimestamp.string(from: self)
    }

    /// Time only: "14:32"
    var timeOnly: String {
        DateFormatter.clawTimeOnly.string(from: self)
    }

    /// Date only: "12 January 2025"
    var dateOnly: String {
        DateFormatter.clawDateOnly.string(from: self)
    }

    /// Relative time: "2 minutes ago", "3 hours ago", "Yesterday", "2 days ago"
    var relativeTime: String {
        let now = Date()
        let secondsAgo = now.timeIntervalSince(self)

        if secondsAgo < 60 {
            return "Just now"
        } else if secondsAgo < 3_600 {
            let minutes = Int(secondsAgo / 60)
            return minutes == 1 ? "1 minute ago" : "\(minutes) minutes ago"
        } else if secondsAgo < 86_400 {
            let hours = Int(secondsAgo / 3_600)
            return hours == 1 ? "1 hour ago" : "\(hours) hours ago"
        } else if isYesterday {
            return "Yesterday"
        } else {
            let days = Int(secondsAgo / 86_400)
            return days == 1 ? "1 day ago" : "\(days) days ago"
        }
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }

    var isThisWeek: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .weekOfYear)
    }
}

extension DateFormatter {
    static let clawWeekdayShort: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "EEE"
        return formatter
    }()

    static let clawWeekdayLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "EEEE"
        return formatter
    }()

    static let clawDayMonthShort: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "d MMM"
        return formatter
    }()

    static let clawDayMonthLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "d MMMM"
        return formatter
    }()

    static let clawDayMonthYearLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "d MMMM yyyy"
        return formatter
    }()

    static let clawFullTimestamp: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "d MMM yyyy, HH:mm"
        return formatter
    }()

    static let clawTimeOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    static let clawDateOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.autoupdatingCurrent
        formatter.dateFormat = "d MMMM yyyy"
        return formatter
    }()
}
