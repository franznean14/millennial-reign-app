"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Clock } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Convert 24-hour to 12-hour format
const to12Hour = (hours24: number): number => {
  if (hours24 === 0) return 12;
  if (hours24 > 12) return hours24 - 12;
  return hours24;
};

// Convert 12-hour to 24-hour format
const to24Hour = (hours12: number, amPm: 'AM' | 'PM'): number => {
  if (amPm === 'AM') {
    return hours12 === 12 ? 0 : hours12;
  } else {
    return hours12 === 12 ? 12 : hours12 + 12;
  }
};

export function TimeSelectModal({
  open,
  onOpenChange,
  startValue,
  endValue,
  onSelect,
  title = "Select Time",
  description = "Choose start and end time",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startValue?: string; // HH:MM format
  endValue?: string; // HH:MM format
  onSelect: (start: string, end: string) => void;
  title?: string;
  description?: string;
}) {
  const [mode, setMode] = useState<'start' | 'end'>('start');
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const amPmRef = useRef<HTMLDivElement>(null);
  const wasClosedByDrag = useRef(false);
  const isProgrammaticScroll = useRef(false);
  // Store current scroll values in refs to avoid re-renders during drag
  const scrollHoursRef = useRef<number | null>(null);
  const scrollMinutesRef = useRef<number | null>(null);
  const scrollAmPmRef = useRef<'AM' | 'PM' | null>(null);
  const listenersAttachedRef = useRef(false);

  // Get current time and round to nearest 5 minutes
  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    return {
      hours24: hours,
      minutes: roundedMinutes >= 60 ? 0 : roundedMinutes,
      amPm: hours >= 12 ? 'PM' : 'AM',
      hours12: to12Hour(hours)
    };
  };

  // Track if user has interacted with the picker
  // Set to true initially if no values provided (so preselected times show)
  const [hasUserInteracted, setHasUserInteracted] = useState(() => {
    // If no values provided, we'll preselect current time, so show it immediately
    return !startValue && !endValue;
  });

  const [startHours, setStartHours] = useState<number>(() => {
    if (startValue) {
      const [h] = startValue.split(':').map(Number);
      return to12Hour(h);
    }
    // Get fresh current time when component initializes
    const currentTime = getCurrentTime();
    return currentTime.hours12;
  });
  const [startMinutes, setStartMinutes] = useState<number>(() => {
    if (startValue) {
      const [, m] = startValue.split(':').map(Number);
      return m || 0;
    }
    // Get fresh current time when component initializes
    const currentTime = getCurrentTime();
    return currentTime.minutes;
  });
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>(() => {
    if (startValue) {
      const [h] = startValue.split(':').map(Number);
      return (h >= 12 ? 'PM' : 'AM') as 'AM' | 'PM';
    }
    // Get fresh current time when component initializes
    const currentTime = getCurrentTime();
    return currentTime.amPm as 'AM' | 'PM';
  });
  // Helper to calculate end time from start time (ensures it's at least 1 hour after)
  const calculateEndTimeFromStart = (startH: number, startM: number, startAmPm: 'AM' | 'PM'): {
    hours24: number;
    hours12: number;
    minutes: number;
    amPm: 'AM' | 'PM';
  } => {
    const start24 = to24Hour(startH, startAmPm);
    const startTotalMinutes = start24 * 60 + startM;
    // Add 1 hour (60 minutes)
    const endTotalMinutes = startTotalMinutes + 60;
    const end24 = Math.floor(endTotalMinutes / 60) % 24;
    const endM = endTotalMinutes % 60;
    return {
      hours24: end24,
      hours12: to12Hour(end24),
      minutes: endM,
      amPm: (end24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM'
    };
  };

  const [endHours, setEndHours] = useState<number>(() => {
    if (endValue) {
      const [h] = endValue.split(':').map(Number);
      return to12Hour(h);
    }
    // Default to 1 hour after start time (or current time if no start time)
    if (startValue) {
      const [h] = startValue.split(':').map(Number);
      const [, m] = startValue.split(':').map(Number);
      const startAmPm = h >= 12 ? 'PM' : 'AM';
      const endTime = calculateEndTimeFromStart(to12Hour(h), m || 0, startAmPm);
      return endTime.hours12;
    }
    // Get fresh current time and add 1 hour
    const currentTime = getCurrentTime();
    const end24 = (currentTime.hours24 + 1) % 24;
    return to12Hour(end24);
  });
  const [endMinutes, setEndMinutes] = useState<number>(() => {
    if (endValue) {
      const [, m] = endValue.split(':').map(Number);
      return m || 0;
    }
    // Default to 1 hour after start time (or current time if no start time)
    if (startValue) {
      const [h] = startValue.split(':').map(Number);
      const [, m] = startValue.split(':').map(Number);
      const startAmPm = h >= 12 ? 'PM' : 'AM';
      const endTime = calculateEndTimeFromStart(to12Hour(h), m || 0, startAmPm);
      return endTime.minutes;
    }
    // Get fresh current time
    const currentTime = getCurrentTime();
    return currentTime.minutes;
  });
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>(() => {
    if (endValue) {
      const [h] = endValue.split(':').map(Number);
      return h >= 12 ? 'PM' : 'AM';
    }
    // Default to 1 hour after start time (or current time if no start time)
    if (startValue) {
      const [h] = startValue.split(':').map(Number);
      const [, m] = startValue.split(':').map(Number);
      const startAmPm = h >= 12 ? 'PM' : 'AM';
      const endTime = calculateEndTimeFromStart(to12Hour(h), m || 0, startAmPm);
      return endTime.amPm;
    }
    // Get fresh current time and add 1 hour
    const currentTime = getCurrentTime();
    const end24 = (currentTime.hours24 + 1) % 24;
    return (end24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM';
  });

  // Format time for display (hours is already in 12-hour format)
  const formatTimeDisplay = (hours12: number, minutes: number, amPm: 'AM' | 'PM'): string => {
    return `${hours12}:${String(minutes).padStart(2, '0')} ${amPm}`;
  };

  const handleConfirm = useCallback(() => {
    const start24Hour = to24Hour(startHours, startAmPm);
    const end24Hour = to24Hour(endHours, endAmPm);
    const startStr = `${String(start24Hour).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
    const endStr = `${String(end24Hour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    onSelect(startStr, endStr);
    onOpenChange(false);
  }, [startHours, startMinutes, startAmPm, endHours, endMinutes, endAmPm, onSelect, onOpenChange]);


  // Get current values based on mode
  const currentHours = mode === 'start' ? startHours : endHours;
  const currentMinutes = mode === 'start' ? startMinutes : endMinutes;
  const currentAmPm = mode === 'start' ? startAmPm : endAmPm;
  const setCurrentHours = mode === 'start' ? setStartHours : setEndHours;
  const setCurrentMinutes = mode === 'start' ? setStartMinutes : setEndMinutes;
  const setCurrentAmPm = mode === 'start' ? setStartAmPm : setEndAmPm;

  // Update from props when they change, or set to current time when modal opens without values
  useEffect(() => {
    if (!open) return;
    if (startValue) {
      const [h] = startValue.split(":").map(Number);
      const [, m] = startValue.split(":").map(Number);
      const startAmPmFromValue = h >= 12 ? "PM" : "AM";
      setStartHours(to12Hour(h));
      setStartMinutes(m || 0);
      setStartAmPm(startAmPmFromValue);
      setHasUserInteracted(true); // If props provided, user has already selected
    } else {
      // No start value - set to current time (fresh calculation when modal opens)
      const currentTime = getCurrentTime();
      setStartHours(currentTime.hours12);
      setStartMinutes(currentTime.minutes);
      setStartAmPm(currentTime.amPm as "AM" | "PM");
    }

    if (endValue) {
      const [h] = endValue.split(":").map(Number);
      const [, m] = endValue.split(":").map(Number);
      setEndHours(to12Hour(h));
      setEndMinutes(m || 0);
      setEndAmPm((h >= 12 ? "PM" : "AM") as "AM" | "PM");
      setHasUserInteracted(true); // If props provided, user has already selected
    } else if (startValue) {
      // No end value but start value exists - calculate from start value
      const [h] = startValue.split(":").map(Number);
      const [, m] = startValue.split(":").map(Number);
      const startAmPmFromValue = h >= 12 ? "PM" : "AM";
      const endTime = calculateEndTimeFromStart(to12Hour(h), m || 0, startAmPmFromValue);
      setEndHours(endTime.hours12);
      setEndMinutes(endTime.minutes);
      setEndAmPm(endTime.amPm as "AM" | "PM");
    } else {
      // No end value and no start value - set to current time + 1 hour (fresh calculation when modal opens)
      const currentTime = getCurrentTime();
      const endTime = calculateEndTimeFromStart(
        currentTime.hours12,
        currentTime.minutes,
        currentTime.amPm as "AM" | "PM"
      );
      setEndHours(endTime.hours12);
      setEndMinutes(endTime.minutes);
      setEndAmPm(endTime.amPm as "AM" | "PM");
    }
  }, [open, startValue, endValue]);

  // Reset interaction state when modal opens/closes
  useEffect(() => {
    if (open) {
      // If no values provided, preselect current time and show it immediately
      if (!startValue && !endValue) {
        setHasUserInteracted(true);
      }
    }
  }, [open, startValue, endValue]);

  // Scroll to element using CSS transitions - no manual animation needed
  const scrollToElement = useCallback((element: HTMLElement) => {
    // Just use native scrollIntoView - CSS will handle the transition
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  }, []);

  // Scroll to center using CSS transitions
  const scrollToCenter = (container: HTMLDivElement | null, type: 'hours' | 'minutes' | 'amPm', value?: number | 'AM' | 'PM') => {
    if (!container) return;
    
    // Mark as programmatic scroll
    isProgrammaticScroll.current = true;
    
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    let targetButton: HTMLButtonElement | null = null;
    
    if (value !== undefined) {
      // Scroll to specific value
      targetButton = buttons.find(btn => {
        const content = btn.textContent?.trim() || '';
        if (type === 'hours' && typeof value === 'number') {
          return parseInt(content) === value;
        } else if (type === 'minutes' && typeof value === 'number') {
          return parseInt(content) === value;
        } else if (type === 'amPm' && (value === 'AM' || value === 'PM')) {
          return content === value;
        }
        return false;
      }) || null;
    } else {
      // Find closest to center
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      
      let closestDistance = Infinity;
      for (const button of buttons) {
        const buttonRect = button.getBoundingClientRect();
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        const distance = Math.abs(buttonCenterY - centerY);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          targetButton = button;
        }
      }
    }
    
    if (targetButton) {
      // Use native scrollIntoView - CSS transitions will handle the smooth animation
      scrollToElement(targetButton);
      
      // Reset flag after transition completes
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 300);
    } else {
      // If no button found, reset immediately
      isProgrammaticScroll.current = false;
    }
  };

  // Handle button click - animate to center
  const handleButtonClick = (
    type: 'hours' | 'minutes' | 'amPm',
    value: number | 'AM' | 'PM',
    button: HTMLButtonElement
  ) => {
    // Mark that user has interacted
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    
    // Scroll button to center - CSS transitions will handle smooth animation
    scrollToElement(button);
    
    // Update selection immediately
    if (type === 'hours' && typeof value === 'number') {
      const newHours = value;
      // If in end mode, validate that the new time is after start time
      if (mode === 'end') {
        const testEnd24 = to24Hour(newHours, currentAmPm);
        const start24 = to24Hour(startHours, startAmPm);
        const testEndTotalMinutes = testEnd24 * 60 + currentMinutes;
        const startTotalMinutes = start24 * 60 + startMinutes;
        if (testEndTotalMinutes <= startTotalMinutes) {
          // Invalid - adjust to be at least 1 hour after start
          const endTime = calculateEndTimeFromStart(startHours, startMinutes, startAmPm);
          setEndHours(endTime.hours12);
          setEndMinutes(endTime.minutes);
          setEndAmPm(endTime.amPm);
          return;
        }
      }
      setCurrentHours(newHours);
    } else if (type === 'minutes' && typeof value === 'number') {
      const newMinutes = value;
      // If in end mode, validate that the new time is after start time
      if (mode === 'end') {
        const testEnd24 = to24Hour(currentHours, currentAmPm);
        const start24 = to24Hour(startHours, startAmPm);
        const testEndTotalMinutes = testEnd24 * 60 + newMinutes;
        const startTotalMinutes = start24 * 60 + startMinutes;
        if (testEndTotalMinutes <= startTotalMinutes) {
          // Invalid - adjust to be at least 1 hour after start
          const endTime = calculateEndTimeFromStart(startHours, startMinutes, startAmPm);
          setEndHours(endTime.hours12);
          setEndMinutes(endTime.minutes);
          setEndAmPm(endTime.amPm);
          return;
        }
      }
      setCurrentMinutes(newMinutes);
    } else if (type === 'amPm' && (value === 'AM' || value === 'PM')) {
      const newAmPm = value;
      // If in end mode, validate that the new time is after start time
      if (mode === 'end') {
        const testEnd24 = to24Hour(currentHours, newAmPm);
        const start24 = to24Hour(startHours, startAmPm);
        const testEndTotalMinutes = testEnd24 * 60 + currentMinutes;
        const startTotalMinutes = start24 * 60 + startMinutes;
        if (testEndTotalMinutes <= startTotalMinutes) {
          // Invalid - adjust to be at least 1 hour after start
          const endTime = calculateEndTimeFromStart(startHours, startMinutes, startAmPm);
          setEndHours(endTime.hours12);
          setEndMinutes(endTime.minutes);
          setEndAmPm(endTime.amPm);
          return;
        }
      }
      setCurrentAmPm(newAmPm);
    }
  };

  // Scroll to selected values when modal opens
  useEffect(() => {
    if (!open) return;
    
    const scrollToSelected = () => {
      // Calculate which values to scroll to based on mode
      const targetHours = mode === 'start' ? startHours : endHours;
      const targetMinutes = mode === 'start' ? startMinutes : endMinutes;
      const targetAmPm = mode === 'start' ? startAmPm : endAmPm;
      
      // Mark as programmatic scroll to prevent selection updates
      isProgrammaticScroll.current = true;
      
      // Scroll hours
      if (hoursRef.current) {
        const buttons = Array.from(hoursRef.current.querySelectorAll('button')) as HTMLButtonElement[];
        const targetButton = buttons.find(btn => parseInt(btn.textContent || '0') === targetHours);
        if (targetButton) {
          targetButton.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
      
      // Scroll minutes
      if (minutesRef.current) {
        const buttons = Array.from(minutesRef.current.querySelectorAll('button')) as HTMLButtonElement[];
        const targetButton = buttons.find(btn => parseInt(btn.textContent || '0') === targetMinutes);
        if (targetButton) {
          targetButton.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
      
      // Scroll AM/PM
      if (amPmRef.current) {
        const buttons = Array.from(amPmRef.current.querySelectorAll('button')) as HTMLButtonElement[];
        const targetButton = buttons.find(btn => btn.textContent?.trim() === targetAmPm);
        if (targetButton) {
          targetButton.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
      
      // Reset flag after scroll completes - shorter timeout to allow user interaction sooner
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
    };

    // Small delay to ensure DOM is ready
    setTimeout(scrollToSelected, 50);
  }, [open]); // Only run when modal opens

  // Scroll to selected values when mode changes (preserve selected times)
  // Only run when mode changes, NOT when values change (to avoid interfering with user scrolling)
  useEffect(() => {
    if (!open) return;
    
    const scrollToSelected = () => {
      // Calculate which values to scroll to based on mode
      const targetHours = mode === 'start' ? startHours : endHours;
      const targetMinutes = mode === 'start' ? startMinutes : endMinutes;
      const targetAmPm = mode === 'start' ? startAmPm : endAmPm;
      
      // Mark as programmatic scroll to prevent selection updates
      isProgrammaticScroll.current = true;
      
      // Scroll hours - CSS transitions will handle smooth animation
      scrollToCenter(hoursRef.current, 'hours', targetHours);
      
      // Scroll minutes - CSS transitions will handle smooth animation
      scrollToCenter(minutesRef.current, 'minutes', targetMinutes);
      
      // Scroll AM/PM - CSS transitions will handle smooth animation
      scrollToCenter(amPmRef.current, 'amPm', targetAmPm);
      
      // Reset flag after scroll completes
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 300);
    };

    // Small delay to ensure DOM is ready
    setTimeout(scrollToSelected, 50);
  }, [mode, scrollToElement]); // Only run when mode changes, not when values change


  // Update selection in real-time during scroll (like Mobiscroll)
  useEffect(() => {
    if (!open) return;
    
    // Track when user actually starts scrolling (not programmatic)
    let userScrollStarted = false;
    
    const updateFromScroll = (container: HTMLDivElement | null, type: 'hours' | 'minutes' | 'amPm') => {
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
      
      let closestButton: HTMLButtonElement | null = null;
      let closestDistance = Infinity;
      
      for (const button of buttons) {
        const buttonRect = button.getBoundingClientRect();
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        const distance = Math.abs(buttonCenterY - centerY);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestButton = button;
        }
      }
      
      if (closestButton) {
        const content = closestButton.textContent?.trim() || '';
        
        // Store in refs during scrolling to avoid re-renders
        if (type === 'hours' && content) {
          const hour = parseInt(content);
          if (!isNaN(hour)) {
            scrollHoursRef.current = hour;
          }
        } else if (type === 'minutes' && content) {
          const minute = parseInt(content);
          if (!isNaN(minute)) {
            scrollMinutesRef.current = minute;
          }
        } else if (type === 'amPm' && content) {
          if (content === 'AM' || content === 'PM') {
            scrollAmPmRef.current = content;
          }
        }
      }
    };

    // Optimized scroll handling like Mobiscroll - use throttling for better performance
    let rafId: number | null = null;
    let isScrolling = false;
    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 16; // ~60fps updates
    
    const handleScroll = () => {
      // Mark that user has interacted and started scrolling
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
      }
      // Mark that user scroll has started (not programmatic)
      userScrollStarted = true;
      // Clear programmatic scroll flag when user starts scrolling
      isProgrammaticScroll.current = false;
      
      const now = performance.now();
      
      // Throttle updates to ~60fps for smoother performance
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return;
      }
      lastUpdateTime = now;
      
      if (!isScrolling) {
        isScrolling = true;
      }
      
      // Cancel any pending scroll end
      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
        scrollEndTimer = null;
      }
      
      // Use requestAnimationFrame for smooth updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        updateFromScroll(hoursRef.current, 'hours');
        updateFromScroll(minutesRef.current, 'minutes');
        updateFromScroll(amPmRef.current, 'amPm');
        rafId = null;
      });
    };


    // Get the currently displayed value from the center of a container
    const getCenterValue = (container: HTMLDivElement | null, type: 'hours' | 'minutes' | 'amPm'): number | 'AM' | 'PM' | null => {
      if (!container) return null;
      
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
      
      let closestButton: HTMLButtonElement | null = null;
      let closestDistance = Infinity;
      
      for (const button of buttons) {
        const buttonRect = button.getBoundingClientRect();
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        const distance = Math.abs(buttonCenterY - centerY);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestButton = button;
        }
      }
      
      if (!closestButton) return null;
      
      const content = closestButton.textContent?.trim() || '';
      if (type === 'hours' && content) {
        const hour = parseInt(content);
        if (!isNaN(hour)) return hour;
      } else if (type === 'minutes' && content) {
        const minute = parseInt(content);
        if (!isNaN(minute)) return minute;
      } else if (type === 'amPm' && (content === 'AM' || content === 'PM')) {
        return content;
      }
      
      return null;
    };

    // Handle scroll end with debouncing - like Mobiscroll
    const handleScrollEnd = () => {
      // Clear any pending scroll end timer
      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
      }
      
      // Debounce scroll end detection - shorter delay for more responsive feel
      scrollEndTimer = setTimeout(() => {
        isScrolling = false;
        
        // Read the actual center values from DOM (most accurate)
        const centerHour = getCenterValue(hoursRef.current, 'hours');
        const centerMinute = getCenterValue(minutesRef.current, 'minutes');
        const centerAmPm = getCenterValue(amPmRef.current, 'amPm');
        
        // Also check refs as fallback (in case DOM reading fails)
        const refHour = scrollHoursRef.current;
        const refMinute = scrollMinutesRef.current;
        const refAmPm = scrollAmPmRef.current;
        
        // Use center values from DOM if available, otherwise use refs
        const finalHour = (centerHour !== null && typeof centerHour === 'number') ? centerHour : (refHour !== null ? refHour : null);
        const finalMinute = (centerMinute !== null && typeof centerMinute === 'number') ? centerMinute : (refMinute !== null ? refMinute : null);
        const finalAmPm = (centerAmPm !== null && (centerAmPm === 'AM' || centerAmPm === 'PM')) ? centerAmPm : (refAmPm !== null ? refAmPm : null);
        
        // Capture current mode to ensure we use the correct mode at scroll end
        const currentMode = mode;
        
        // Update state from values (only when user lets go) - this triggers re-render
        // Always update if we have valid values, regardless of null checks
        if (finalHour !== null && typeof finalHour === 'number') {
          if (currentMode === 'start') {
            setStartHours(finalHour);
          } else {
            setEndHours(finalHour);
          }
        }
        if (finalMinute !== null && typeof finalMinute === 'number') {
          if (currentMode === 'start') {
            setStartMinutes(finalMinute);
          } else {
            setEndMinutes(finalMinute);
          }
        }
        if (finalAmPm !== null && (finalAmPm === 'AM' || finalAmPm === 'PM')) {
          if (currentMode === 'start') {
            setStartAmPm(finalAmPm);
          } else {
            setEndAmPm(finalAmPm);
          }
        }
        
        // Clear refs
        scrollHoursRef.current = null;
        scrollMinutesRef.current = null;
        scrollAmPmRef.current = null;
        
        // Small delay to let state update, then animate to center based on latest state
        requestAnimationFrame(() => {
          const scrollHour = finalHour !== null && typeof finalHour === 'number' ? finalHour : (mode === 'start' ? startHours : endHours);
          const scrollMinute = finalMinute !== null && typeof finalMinute === 'number' ? finalMinute : (mode === 'start' ? startMinutes : endMinutes);
          const scrollAmPm = finalAmPm !== null && (finalAmPm === 'AM' || finalAmPm === 'PM') ? finalAmPm : (mode === 'start' ? startAmPm : endAmPm);
          
          scrollToCenter(hoursRef.current, 'hours', scrollHour);
          scrollToCenter(minutesRef.current, 'minutes', scrollMinute);
          scrollToCenter(amPmRef.current, 'amPm', scrollAmPm);
        });
        
        scrollEndTimer = null;
      }, 100); // Shorter delay for more responsive feel
    };
    
    // Also handle touch end for immediate feedback on mobile
    const handleTouchEnd = () => {
      // On touch end, immediately check position and snap if needed
      requestAnimationFrame(() => {
        if (!isScrolling) {
          // Use current state values to scroll to
          const currentH = mode === 'start' ? startHours : endHours;
          const currentM = mode === 'start' ? startMinutes : endMinutes;
          const currentAP = mode === 'start' ? startAmPm : endAmPm;
          
          scrollToCenter(hoursRef.current, 'hours', currentH);
          scrollToCenter(minutesRef.current, 'minutes', currentM);
          scrollToCenter(amPmRef.current, 'amPm', currentAP);
        }
      });
    };

    const handleScrollEndObserver = () => {
      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = setTimeout(() => {
        handleScrollEnd();
      }, 150);
    };

    const attachListeners = () => {
      const hoursContainer = hoursRef.current;
      const minutesContainer = minutesRef.current;
      const amPmContainer = amPmRef.current;
      if (!hoursContainer || !minutesContainer || !amPmContainer) {
        return false;
      }
      if (listenersAttachedRef.current) {
        return true;
      }

      // Add event listeners with passive for better performance
      hoursContainer.addEventListener('scroll', handleScroll, { passive: true });
      hoursContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
      minutesContainer.addEventListener('scroll', handleScroll, { passive: true });
      minutesContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
      amPmContainer.addEventListener('scroll', handleScroll, { passive: true });
      amPmContainer.addEventListener('touchend', handleTouchEnd, { passive: true });

      // Use scroll events to detect scroll end (more reliable than timeout)
      hoursContainer.addEventListener('scroll', handleScrollEndObserver, { passive: true });
      minutesContainer.addEventListener('scroll', handleScrollEndObserver, { passive: true });
      amPmContainer.addEventListener('scroll', handleScrollEndObserver, { passive: true });

      listenersAttachedRef.current = true;
      return true;
    };

    // Ensure listeners attach after refs are mounted (modal content may mount after effect runs)
    let retryCount = 0;
    const tryAttach = () => {
      if (attachListeners()) return;
      retryCount += 1;
      if (retryCount < 5) {
        setTimeout(tryAttach, 50);
      }
    };
    tryAttach();

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
      }
      const hoursContainer = hoursRef.current;
      const minutesContainer = minutesRef.current;
      const amPmContainer = amPmRef.current;
      if (hoursContainer) {
        hoursContainer.removeEventListener('scroll', handleScroll);
        hoursContainer.removeEventListener('scroll', handleScrollEndObserver);
        hoursContainer.removeEventListener('touchend', handleTouchEnd);
      }
      if (minutesContainer) {
        minutesContainer.removeEventListener('scroll', handleScroll);
        minutesContainer.removeEventListener('scroll', handleScrollEndObserver);
        minutesContainer.removeEventListener('touchend', handleTouchEnd);
      }
      if (amPmContainer) {
        amPmContainer.removeEventListener('scroll', handleScroll);
        amPmContainer.removeEventListener('scroll', handleScrollEndObserver);
        amPmContainer.removeEventListener('touchend', handleTouchEnd);
      }
      listenersAttachedRef.current = false;
    };
  }, [open, mode, currentHours, currentMinutes, currentAmPm, hasUserInteracted]);

  // Handle drawer close - detect if it was dragged closed vs button click
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && open) {
      // Drawer is being closed
      // If wasClosedByDrag is false, it means it was closed by dragging (not button click)
      if (!wasClosedByDrag.current) {
        // Was closed by dragging, don't save - just close
        onOpenChange(false);
        return;
      }
      // Was closed by button (Cancel or Confirm), save is already handled in handleConfirm for Confirm button
      // For Cancel, we just close without saving
      wasClosedByDrag.current = false; // Reset flag
      onOpenChange(false);
      return;
    }
    // Opening drawer - reset flag
    if (newOpen) {
      wasClosedByDrag.current = false;
    }
    onOpenChange(newOpen);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange} title={title} description={description} className="sm:max-w-[400px]">
      <div className="p-4 pt-6 pb-6">
        {/* Start/End Toggle */}
        <div className="flex gap-2 mb-4 py-3">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as 'start' | 'end')} className="w-full">
            <ToggleGroupItem value="start" className="flex-1 py-6 px-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Start</span>
                <span className="text-sm font-medium">
                  {hasUserInteracted || startValue ? formatTimeDisplay(startHours, startMinutes, startAmPm) : ''}
                </span>
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem value="end" className="flex-1 py-6 px-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">End</span>
                <span className="text-sm font-medium">
                  {hasUserInteracted || endValue ? formatTimeDisplay(endHours, endMinutes, endAmPm) : ''}
                </span>
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="relative flex items-center justify-center gap-4 py-4">
          {/* Single streak overlay across all columns */}
          <div className="absolute left-4 right-4 h-[44px] top-1/2 -translate-y-1/2 border-y border-primary/20 bg-primary/5 pointer-events-none z-20 rounded-md" />
          {/* Hours */}
          <div className="flex flex-col items-center gap-2 relative">
            {/* Fade gradients on wrapper */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
            <div 
              ref={hoursRef} 
              className="time-picker-scroll flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-hide relative"
              style={{
                scrollSnapType: 'y mandatory',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Top padding for center alignment */}
              <div className="h-[88px] flex-shrink-0" />
              {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                <Button
                  key={hour}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-16 text-base flex-shrink-0"
                  style={{ scrollSnapAlign: 'center' }}
                  onClick={(e) => handleButtonClick('hours', hour, e.currentTarget)}
                >
                  {hour}
                </Button>
              ))}
              {/* Bottom padding for center alignment */}
              <div className="h-[88px] flex-shrink-0" />
            </div>
          </div>

          {/* Minutes */}
          <div className="flex flex-col items-center gap-2 relative">
            {/* Fade gradients on wrapper */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
            <div 
              ref={minutesRef} 
              className="time-picker-scroll flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-hide relative"
              style={{
                scrollSnapType: 'y mandatory',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Top padding for center alignment */}
              <div className="h-[88px] flex-shrink-0" />
              {Array.from({ length: 60 }, (_, i) => i).filter(m => m % 5 === 0).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-16 text-base flex-shrink-0"
                  style={{ scrollSnapAlign: 'center' }}
                  onClick={(e) => handleButtonClick('minutes', m, e.currentTarget)}
                >
                  {String(m).padStart(2, '0')}
                </Button>
              ))}
              {/* Bottom padding for center alignment */}
              <div className="h-[88px] flex-shrink-0" />
            </div>
          </div>

          {/* AM/PM */}
          <div className="flex flex-col items-center gap-2 relative">
            {/* Fade gradients on wrapper */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
            <div 
              ref={amPmRef} 
              className="time-picker-scroll flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-hide relative"
              style={{
                scrollSnapType: 'y mandatory',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Top padding for center alignment */}
              <div className="h-[88px] flex-shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-16 text-base flex-shrink-0"
                style={{ scrollSnapAlign: 'center' }}
                onClick={(e) => handleButtonClick('amPm', 'AM', e.currentTarget)}
              >
                AM
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-16 text-base flex-shrink-0"
                style={{ scrollSnapAlign: 'center' }}
                onClick={(e) => handleButtonClick('amPm', 'PM', e.currentTarget)}
              >
                PM
              </Button>
              {/* Bottom padding for center alignment */}
              <div className="h-[88px] flex-shrink-0" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => {
            wasClosedByDrag.current = true; // Mark as closed by button
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button type="button" onClick={() => {
            wasClosedByDrag.current = true; // Mark as closed by confirm button
            handleConfirm();
          }}>
            Confirm
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
