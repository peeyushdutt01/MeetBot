import React from 'react';

const AuthShell = ({ children }) => (
  <main className="auth-container">
    <div className="auth-layout">
      <aside className="auth-story" aria-label="About MeetBot">
        <div className="brand auth-story-brand"><span className="brand-mark">M</span><span>meetbot<span className="brand-dot">.</span></span></div>
        <div className="auth-story-copy">
          <span className="eyebrow">A CLEARER WAY TO MEET</span>
          <h1>Make room for the conversation.</h1>
          <p>Keep the important parts of every meeting close: what was said, what was decided, and what happens next.</p>
        </div>
        <div className="auth-story-steps" aria-hidden="true">
          <span><b>01</b> Capture</span>
          <span><b>02</b> Understand</span>
          <span><b>03</b> Follow through</span>
        </div>
      </aside>
      <section className="auth-card">
        <div className="logo-container"><span className="brand"><span className="brand-mark">M</span><span>meetbot<span className="brand-dot">.</span></span></span></div>
        {children}
      </section>
    </div>
  </main>
);

export default AuthShell;
