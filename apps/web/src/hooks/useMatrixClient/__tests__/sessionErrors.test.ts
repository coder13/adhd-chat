/// <reference types="jest" />

import {
  EXPIRED_SESSION_MESSAGE,
  getAuthFailureMessage,
  isInactiveMatrixSessionError,
} from '../sessionErrors';

describe('sessionErrors', () => {
  it('detects inactive-token matrix errors', () => {
    expect(
      isInactiveMatrixSessionError({
        errcode: 'M_UNKNOWN_TOKEN',
        httpStatus: 401,
        message: 'Token is not active',
      })
    ).toBe(true);
  });

  it('maps inactive-token failures to product copy', () => {
    expect(
      getAuthFailureMessage({
        data: { errcode: 'M_UNKNOWN_TOKEN', error: 'Token is not active' },
        statusCode: 401,
      })
    ).toBe(EXPIRED_SESSION_MESSAGE);
  });

  it('detects raw matrix sdk inactive-token messages even without structured status fields', () => {
    expect(
      isInactiveMatrixSessionError(
        new Error('MatrixError: [401] Token is not active')
      )
    ).toBe(true);
  });
});
