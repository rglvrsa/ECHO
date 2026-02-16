/**
 * Matching Service
 * Implements context-based matching with college, city, and interests
 */

/**
 * Calculate matching score between two user profiles
 * @param {Object} profile1 - First user profile {college, city, interests}
 * @param {Object} profile2 - Second user profile {college, city, interests}
 * @returns {Object} {score: 0-100, commonInterests: Array}
 */
const calculateMatchScore = (profile1, profile2) => {
  if (!profile1 || !profile2) {
    return { score: 0, commonInterests: [] };
  }

  let score = 0;
  const weights = {
    college: 30,     // College/org match is worth 30 points
    city: 35,        // City match is worth 35 points
    interests: 35    // Each common interest contributes to 35 points
  };

  // Interests matching first (independent of other factors)
  const commonInterests = findCommonInterests(profile1.interests, profile2.interests);
  let interestScore = 0;
  
  if (commonInterests.length > 0 && profile1.interests.length > 0) {
    // Calculate percentage of common interests
    const maxInterests = Math.max(profile1.interests.length, profile2.interests.length);
    interestScore = (commonInterests.length / maxInterests) * weights.interests;
    score += interestScore;
  }

  // City matching (35 points max) - HIGH PRIORITY
  const citiesMatch = profile1.city &&
    profile2.city &&
    profile1.city.toLowerCase().trim() === profile2.city.toLowerCase().trim();
  
  if (citiesMatch) {
    score += weights.city;
  }

  // College matching (30 points max) - Only if present in both
  const collegeMatch = profile1.college &&
    profile2.college &&
    profile1.college.toLowerCase().trim() === profile2.college.toLowerCase().trim();
  
  if (collegeMatch) {
    score += weights.college;
  }

  return {
    score: Math.round(score),
    commonInterests
  };
};

/**
 * Find common interests between two users
 * @param {Array} interests1 - First user interests
 * @param {Array} interests2 - Second user interests
 * @returns {Array} Common interests
 */
const findCommonInterests = (interests1 = [], interests2 = []) => {
  if (!Array.isArray(interests1) || !Array.isArray(interests2)) {
    return [];
  }
  
  return interests1.filter(interest =>
    interests2.some(
      i => i.toLowerCase().trim() === interest.toLowerCase().trim()
    )
  );
};

/**
 * Find best match from waiting users
 * @param {Array} waitingUsers - Array of waiting user sockets with profiles
 * @param {String} excludeSocketId - Socket ID to exclude from search
 * @param {Object} userProfile - Current user's profile
 * @returns {Object} {socket, matchScore, commonInterests} or null if no good match
 */
const findBestMatch = (waitingUsers, excludeSocketId, userProfile) => {
  if (!waitingUsers || waitingUsers.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;
  let bestCommonInterests = [];

  for (const waitingSocket of waitingUsers) {
    // Skip if same socket or no profile
    if (waitingSocket.id === excludeSocketId || !waitingSocket.userProfile) {
      continue;
    }

    // Check if socket is still connected
    if (!waitingSocket.connected) {
      continue;
    }

    // Calculate match score
    const matchResult = calculateMatchScore(userProfile, waitingSocket.userProfile);

    // Update best match if this is better
    if (matchResult.score > bestScore) {
      bestScore = matchResult.score;
      bestMatch = waitingSocket;
      bestCommonInterests = matchResult.commonInterests;
    }
  }

  return bestMatch
    ? {
        socket: bestMatch,
        matchScore: bestScore,
        commonInterests: bestCommonInterests
      }
    : null;
};

/**
 * Check if a profile is valid for smart matching
 * @param {Object} profile - User profile
 * @returns {Boolean}
 */
const isValidSmartMatchProfile = (profile) => {
  return (
    profile &&
    profile.city &&
    profile.city.trim() !== '' &&
    Array.isArray(profile.interests) &&
    profile.interests.length > 0
  );
};

/**
 * Format match information for chat display
 * @param {Array} commonInterests - Array of common interests
 * @param {Object} profile1 - Current user profile
 * @param {Object} profile2 - Partner profile
 * @returns {Object} Formatted match info
 */
const formatMatchInfo = (commonInterests, profile1, profile2) => {
  const matchInfo = {};

  // Validate profiles exist
  if (!profile1 || !profile2) {
    console.log('⚠️  formatMatchInfo: Missing profile - profile1:', profile1, 'profile2:', profile2);
    return matchInfo;
  }

  console.log('🔧 formatMatchInfo processing:');
  console.log('   Profile1 city:', profile1.city, 'type:', typeof profile1.city);
  console.log('   Profile2 city:', profile2.city, 'type:', typeof profile2.city);
  console.log('   Profile1 college:', profile1.college, 'type:', typeof profile1.college);
  console.log('   Profile2 college:', profile2.college, 'type:', typeof profile2.college);
  console.log('   commonInterests:', commonInterests, 'type:', typeof commonInterests);

  // Add common city info
  if (profile1.city && profile2.city) {
    const city1 = String(profile1.city).toLowerCase().trim();
    const city2 = String(profile2.city).toLowerCase().trim();
    console.log('   Comparing cities: "' + city1 + '" === "' + city2 + '" ?', city1 === city2);
    
    if (city1 === city2) {
      matchInfo.sameCityMessage = `You are both from ${profile1.city}! 🌍`;
      console.log('   ✅ City match found!');
    }
  } else {
    console.log('   ❌ City missing in one or both profiles');
  }

  // Add common college info
  if (profile1.college && profile2.college) {
    const college1 = String(profile1.college).toLowerCase().trim();
    const college2 = String(profile2.college).toLowerCase().trim();
    console.log('   Comparing colleges: "' + college1 + '" === "' + college2 + '" ?', college1 === college2);
    
    if (college1 === college2) {
      matchInfo.sameCollegeMessage = `You both study/work at ${profile1.college}! 🎓`;
      console.log('   ✅ College match found!');
    }
  } else {
    console.log('   ❌ College missing in one or both profiles (this is ok, college is optional)');
  }

  // Add common interests
  if (Array.isArray(commonInterests) && commonInterests.length > 0) {
    matchInfo.commonInterestsMessage = `You both love: ${commonInterests.join(', ')} 🎯`;
    matchInfo.commonInterests = commonInterests;
    console.log('   ✅ Common interests found:', commonInterests);
  } else {
    console.log('   ❌ No common interests or not an array:', commonInterests);
  }

  console.log('   Final matchInfo:', matchInfo);
  return matchInfo;
};

module.exports = {
  calculateMatchScore,
  findCommonInterests,
  findBestMatch,
  isValidSmartMatchProfile,
  formatMatchInfo
};
