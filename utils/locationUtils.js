/**
 * Location utility functions for distance calculations and validation
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if check-in location is within acceptable radius of meeting address
 * @param {number} checkInLat - Check-in latitude
 * @param {number} checkInLon - Check-in longitude
 * @param {number} meetingLat - Meeting address latitude
 * @param {number} meetingLon - Meeting address longitude
 * @param {number} maxRadiusMeters - Maximum allowed radius in meters (default: 500m)
 * @returns {Object} { isValid: boolean, distance: number, message: string }
 */
function validateLocationProximity(checkInLat, checkInLon, meetingLat, meetingLon, maxRadiusMeters = 500) {
  if (!meetingLat || !meetingLon) {
    // If meeting doesn't have coordinates, we can't validate
    // This should be optional - some meetings might not have exact coordinates
    return {
      isValid: true,
      distance: null,
      message: 'Meeting location coordinates not available. Validation skipped.'
    };
  }

  const distance = calculateDistance(checkInLat, checkInLon, meetingLat, meetingLon);

  if (distance <= maxRadiusMeters) {
    return {
      isValid: true,
      distance: Math.round(distance),
      message: `Location verified. Check-in is ${Math.round(distance)}m from meeting location.`
    };
  } else {
    return {
      isValid: false,
      distance: Math.round(distance),
      message: `Check-in location is ${Math.round(distance)}m away from meeting location (max allowed: ${maxRadiusMeters}m). Please ensure you are at the correct location.`
    };
  }
}

/**
 * Check if check-in is within allowed time window
 * @param {Date} meetingDate - Scheduled meeting date
 * @param {Date} checkInTime - Check-in timestamp
 * @param {number} allowedHoursBefore - Hours before meeting allowed (default: 2)
 * @param {number} allowedHoursAfter - Hours after meeting allowed (default: 24)
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateTimeWindow(meetingDate, checkInTime, allowedHoursBefore = 2, allowedHoursAfter = 24) {
  const meetingDateTime = new Date(meetingDate);
  meetingDateTime.setHours(0, 0, 0, 0); // Start of meeting date
  
  const checkInDateTime = new Date(checkInTime);
  
  // Calculate time difference in hours
  const hoursDiff = (checkInDateTime - meetingDateTime) / (1000 * 60 * 60);
  
  // Allow check-in from (allowedHoursBefore) hours before meeting date to (allowedHoursAfter) hours after
  const hoursBefore = -allowedHoursBefore; // Negative for "before"
  const hoursAfter = allowedHoursAfter;
  
  if (hoursDiff < hoursBefore) {
    return {
      isValid: false,
      message: `Check-in is too early. Check-in is allowed from ${allowedHoursBefore} hours before the meeting date.`
    };
  }
  
  if (hoursDiff > hoursAfter) {
    return {
      isValid: false,
      message: `Check-in is too late. Check-in is allowed up to ${allowedHoursAfter} hours after the meeting date.`
    };
  }
  
  return {
    isValid: true,
    message: 'Check-in is within allowed time window.'
  };
}

module.exports = {
  calculateDistance,
  validateLocationProximity,
  validateTimeWindow
};

