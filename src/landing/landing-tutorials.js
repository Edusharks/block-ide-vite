// This file contains the steps for the landing page's introductory tour.

export const landingTourSteps = [
  {
    id: 'welcome',
    title: 'Welcome to the Block IDE!',
    text: `
      <img src="https://static.wixstatic.com/media/6c9fb0_2693605153ca466b9186ab5a5cdbe201~mv2.png/v1/fill/w_316,h_110,fp_0.50_0.50,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Edusharks%20(1).png" alt="EduSharks Logo" style="width: 150px; margin: 0 auto 1rem; display: block;">
      This is your mission control for creating amazing hardware and simulation projects with block-based code! This quick tour will show you how to get started.
    `,
    buttons: [
      {
        text: `Let's Go! <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/></svg>`,
        action() { return this.next(); }
      }
    ]
  },
  {
    id: 'create-project',
    title: 'Create a Project',
    text: 'This is where the magic begins! Click here to start a new hardware or simulation project from scratch.',
    attachTo: { element: '#create-new-project-btn', on: 'right' },
    buttons: [
      { text: 'Back', classes: 'shepherd-button-secondary', action() { return this.back(); }},
      { text: 'Next', action() { return this.next(); }}
    ]
  },
  {
    id: 'your-projects',
    title: 'Your Projects',
    text: 'Your saved projects will appear here. You can click on them to continue your work.',
    attachTo: { element: '#projects-grid', on: 'bottom' },
    buttons: [
      { text: 'Back', classes: 'shepherd-button-secondary', action() { return this.back(); }},
      { text: 'Next', action() { return this.next(); }}
    ]
  },
  {
    id: 'search-sort',
    title: 'Find Your Work',
    text: 'As your project list grows, you can use the search bar and sort dropdown to find exactly what you\'re looking for.',
    attachTo: { element: '.project-actions', on: 'bottom' },
    buttons: [
      { text: 'Back', classes: 'shepherd-button-secondary', action() { return this.back(); }},
      { text: 'Next', action() { return this.next(); }}
    ]
  },
  {
    id: 'examples',
    title: 'Start from an Example',
    text: 'Not sure where to begin? Explore these pre-built examples to see what the IDE can do!',
    attachTo: { element: '#examples-grid', on: 'top' },
    buttons: [
      { text: 'Back', classes: 'shepherd-button-secondary', action() { return this.back(); }},
      { text: 'Next', action() { return this.next(); }}
    ]
  },
  {
    id: 'tutorials',
    title: 'Interactive Tutorials',
    text: 'These cards will launch a new project and guide you step-by-step through a specific feature.',
    attachTo: { element: '#tutorials-grid', on: 'top' },
    buttons: [
      { text: 'Back', classes: 'shepherd-button-secondary', action() { return this.back(); }},
      { text: 'Next', action() { return this.next(); }}
    ]
  },
  {
    id: 'import-themes',
    title: 'Import & Customize',
    text: 'You can import projects from a file using the button up here, and change the look of the IDE with the theme switcher in the corner.',
    attachTo: { element: '.header-actions', on: 'bottom' },
    buttons: [
      { text: 'Back', classes: 'shepherd-button-secondary', action() { return this.back(); }},
      { text: 'Finish', action() { return this.complete(); }}
    ]
  }
];