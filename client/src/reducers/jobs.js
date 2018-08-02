import actionTypes from '../actions/actionTypes';

const defaultState = {
  availableJobs: [],
  matchedJobs: [],
};

export default (state = defaultState, action) => {
  switch (action.type) {
    case actionTypes.GET_JOBS.IN_PROGRESS:
      return {
        ...state,
        inProgress: true,
      };
    case actionTypes.GET_JOBS.SUCCESS:
      return {
        ...state,
        inProgress: false,
        availableJobs: action.availableJobs,
      };
    case actionTypes.GET_JOBS.ERROR:
      return {
        ...state,
        inProgress: false,
        availableJobs: [],
      };
    case actionTypes.POST_JOB.IN_PROGRESS:
      return {
        ...state,
        inProgress: true,
      };
    case actionTypes.POST_JOB.SUCCESS:
      return {
        ...state,
        inProgress: false,
        availableJobs: action.availableJobs,
      };
    case actionTypes.POST_JOB.ERROR:
      return {
        ...state,
        inProgress: false,
        availableJobs: [],
      };
    case actionTypes.CLEAR_STATE:
      return defaultState;
    case actionTypes.LIKE_JOB.SUCCESS:
      return {
        ...state,
        availableJobs: state.availableJobs.slice(1),
      };
    case actionTypes.GET_JOB_MATCHES.SUCCESS:
      return {
        ...state,
        matchedJobs: action.matchedJobs,
      };
    default:
      return state;
  }
};
