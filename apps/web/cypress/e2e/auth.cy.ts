describe('password login', () => {
  it('signs into the app with a provisioned Synapse account', () => {
    cy.task<{
      baseUrl: string;
      username: string;
      password: string;
      userId: string;
    }>('provisionMatrixUser').then((account) => {
      cy.visit('/login');
      cy.contains('button', 'Password').click();
      cy.get('[data-testid="homeserver-input"]').clear().type(account.baseUrl);
      cy.get('[data-testid="username-input"]').type(account.username);
      cy.get('[data-testid="password-input"]').type(account.password, {
        log: false,
      });
      cy.get('[data-testid="password-login-button"]').click();

      cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
      cy.contains('Hubs').should('be.visible');
      cy.window().then((window) => {
        const session = window.localStorage.getItem('matrix.session.v1');

        expect(session).to.include(account.userId);
        expect(session).to.include(account.baseUrl);
      });
    });
  });
});
