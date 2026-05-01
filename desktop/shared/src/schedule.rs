use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScheduleWindow {
    pub day: u8,
    pub start_minutes: u16,
    pub end_minutes: u16,
}

pub fn is_active(windows: &[ScheduleWindow], day: u8, minute_of_day: u16) -> bool {
    windows.iter().any(|window| window_matches(window, day, minute_of_day))
}

fn window_matches(window: &ScheduleWindow, day: u8, minute_of_day: u16) -> bool {
    if window.start_minutes == window.end_minutes {
        return window.day == day;
    }

    if window.start_minutes < window.end_minutes {
        return window.day == day
            && minute_of_day >= window.start_minutes
            && minute_of_day < window.end_minutes;
    }

    let next_day = (window.day + 1) % 7;

    (window.day == day && minute_of_day >= window.start_minutes)
        || (next_day == day && minute_of_day < window.end_minutes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_day_window_matches_inside_range() {
        let windows = vec![ScheduleWindow {
            day: 1,
            start_minutes: 9 * 60,
            end_minutes: 17 * 60,
        }];

        assert!(is_active(&windows, 1, 10 * 60));
        assert!(!is_active(&windows, 1, 8 * 60));
        assert!(!is_active(&windows, 1, 17 * 60));
        assert!(!is_active(&windows, 2, 10 * 60));
    }

    #[test]
    fn overnight_window_matches_next_day() {
        let windows = vec![ScheduleWindow {
            day: 5,
            start_minutes: 22 * 60,
            end_minutes: 6 * 60,
        }];

        assert!(is_active(&windows, 5, 23 * 60));
        assert!(is_active(&windows, 6, 5 * 60));
        assert!(!is_active(&windows, 6, 7 * 60));
    }

    #[test]
    fn equal_start_and_end_means_full_day() {
        let windows = vec![ScheduleWindow {
            day: 3,
            start_minutes: 0,
            end_minutes: 0,
        }];

        assert!(is_active(&windows, 3, 0));
        assert!(is_active(&windows, 3, 23 * 60));
        assert!(!is_active(&windows, 4, 12 * 60));
    }
}
