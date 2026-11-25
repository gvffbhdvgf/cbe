export class LearnerRlsUnavailableError extends Error {
  constructor() {
    super('Learner data service is temporarily unavailable');
    this.name = 'LearnerRlsUnavailableError';
  }
}

export class LearnerAuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'LearnerAuthenticationError';
  }
}
