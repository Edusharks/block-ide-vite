import './landing.css'; 
import 'shepherd.js/dist/css/shepherd.css';
import esp32ImageUrl from '/src/assets/ESP32.png';
import picoImageUrl from '/src/assets/Pico.png';
import Shepherd from 'shepherd.js';
import JSZip from 'jszip';
import { applyTheme } from '../shared/theme-loader.js';
import { showCustomPrompt, showCustomConfirm } from '../shared/utils/modals.js';
import { getAllProjects, saveProject, deleteProjectByName, getWorkspace, saveWorkspace, getExtensions, saveExtensions } from '../shared/utils/db.js';
import { ideTutorials as tutorials } from '../ide/ide-tutorials.js';
import { landingTourSteps } from './landing-tutorials.js';

document.addEventListener('DOMContentLoaded', () => {
    // === UI Elements ===
    const projectsGrid = document.getElementById('projects-grid');
    const examplesGrid = document.getElementById('examples-grid');
    const tutorialsGrid = document.getElementById('tutorials-grid');
    const createProjectBtn = document.getElementById('create-new-project-btn');
    const searchInput = document.getElementById('search-projects');
    const sortSelect = document.getElementById('sort-projects');
    const importProjectBtn = document.getElementById('import-project-btn');
    const importFileInput = document.getElementById('import-file-input');
    const blockCreatorBtn = document.getElementById('block-creator-btn');

    const contextMenu = document.getElementById('project-context-menu');
    const ctxRenameBtn = document.getElementById('ctx-rename');
    const ctxDuplicateBtn = document.getElementById('ctx-duplicate');
    const ctxDeleteBtn = document.getElementById('ctx-delete');

    const dragDropOverlay = document.getElementById('drag-drop-overlay');
    const landingContainer = document.querySelector('.landing-container');

    // Modal Elements
    const newProjectModal = document.getElementById('new-project-modal');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalNextBtn = document.getElementById('modal-next-btn');
    const modalBackBtn = document.getElementById('modal-back-btn');
    const modalCreateBtn = document.getElementById('modal-create-btn');
    const projectNameInput = document.getElementById('modal-project-name');
    const hardwareTypeCard = document.querySelector('.type-card[data-type="hardware"]');
    const simulationTypeCard = document.querySelector('.type-card[data-type="simulation"]');
    const boardGrid = newProjectModal.querySelector('.board-grid');
    const step1 = document.getElementById('step-1-name-type');
    const step2 = document.getElementById('step-2-board');
    
    // Theme switcher buttons
    const lightThemeBtn = document.getElementById('theme-light');
    const darkThemeBtn = document.getElementById('theme-dark');
    const contrastThemeBtn = document.getElementById('theme-contrast');

    // === State ===
    let allProjects = [];
    let contextMenuProject = null;
    let selectedBoardForProject = null;
    let selectedProjectType = null;
    const THEME_KEY = 'blockIdeTheme';

    // === Board & Example Definitions ===
    const boards = [
    { id: 'esp32', name: 'ESP32', image: esp32ImageUrl },
    { id: 'pico', name: 'Raspberry Pi Pico', image: picoImageUrl }
    ];
    const exampleProjects = [
         { name: "AI Gesture Mouse", boardId: "esp32", description: "Use hand gestures to control your mouse." },
         { name: "IoT Weather Station", boardId: "esp32", description: "View sensor data on a web dashboard." },
         { name: "Catch the Dot", boardId: "simulation", description: "A simple and fun simulation game." }
    ];

    // === Core Functions ===
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
        updateThemeButtons(theme);
    }

    function updateThemeButtons(activeTheme) {
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`theme-${activeTheme}`);
        if(activeBtn) activeBtn.classList.add('active');
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'Not modified yet';
        const date = new Date(timestamp);
        return `Modified: ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
    }
    
    function getBoardIcon(boardId) {
        switch(boardId) {
            case 'esp32': return `<svg viewBox="0 0 24 24"><path d="M5 11h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9Z"/><path d="M17.5 11a5.5 5.5 0 1 0-11 0"/><path d="M22 11h-2"/><path d="M4 11H2"/></svg>`;
            case 'pico': return `<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 7v10"/><path d="M17 7v10"/><path d="M21 12h-2"/><path d="M5 12H3"/></svg>`;
            case 'simulation': return `<svg viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="m19 19-7-7 7-7"/></svg>`;
            default: return '';
        }
    }

    async function updateDisplayedProjects() {
        allProjects = await getAllProjects();
        const searchTerm = searchInput.value.toLowerCase();
        const sortValue = sortSelect.value;
        let filteredProjects = allProjects.filter(p => p.name.toLowerCase().includes(searchTerm));
        filteredProjects.sort((a, b) => {
            switch (sortValue) {
                case 'modified-asc': return a.modifiedAt - b.modifiedAt;
                case 'name-asc': return a.name.localeCompare(b.name);
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'modified-desc': default: return b.modifiedAt - a.modifiedAt;
            }
        });
        renderProjectCards(filteredProjects);
    }
    
    function renderProjectCards(projectsToRender) {
        projectsGrid.querySelectorAll('.project-card:not(.create-card)').forEach(card => card.remove());
            projectsToRender.forEach(project => {
                const card = document.createElement('div');
                card.className = 'project-card';
                const boardName = project.boardId ? (project.boardId === 'simulation' ? 'Simulation' : project.boardId.toUpperCase()) : 'Hardware';
                card.innerHTML = `
                    <div class="card-header"><div class="card-board-icon">${getBoardIcon(project.boardId)}</div><button class="card-context-btn" title="More options">...</button></div>
                    <div class="card-footer"><h3>${project.name}</h3><p>${boardName} Project</p><p class="modified-date">${formatDate(project.modifiedAt)}</p></div>`;
                card.addEventListener('click', e => { if (!e.target.closest('.card-context-btn')) { openProject(project); } });
                card.querySelector('.card-context-btn').addEventListener('click', e => { e.stopPropagation(); showContextMenu(e, project); });
                projectsGrid.appendChild(card);
            });
    }
    
    function renderExampleCards() {
        examplesGrid.innerHTML = '';
        exampleProjects.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'project-card example-card';
            card.innerHTML = `<div class="card-header"><div class="card-board-icon">${getBoardIcon(ex.boardId)}</div></div><div class="card-footer"><h3>${ex.name}</h3><p>${ex.description}</p></div>`;
            card.addEventListener('click', () => {
                showCustomConfirm(`This will create a new project named "${ex.name}". Do you want to continue?`, confirmed => {
                    if (confirmed) alert(`Creating the "${ex.name}" example is not yet implemented.`);
                });
            });
            examplesGrid.appendChild(card);
        });
    }

    function renderTutorialCards() {
        tutorialsGrid.innerHTML = '';
        tutorials.forEach(tutorial => {
            const card = document.createElement('div');
            card.className = 'project-card tutorial-card';
            card.innerHTML = `<div class="card-header"><div class="card-board-icon">${tutorial.icon}</div></div><div class="card-footer"><h3>${tutorial.title}</h3><p>${tutorial.description}</p></div>`;
            card.addEventListener('click', async () => {
                let projectName = tutorial.title;
                const existingProjects = await getAllProjects();
                if (existingProjects.some(p => p.name === projectName)) {
                     showCustomConfirm(`A project named "${projectName}" already exists. Create a copy?`, confirmed => {
                        if (confirmed) {
                            let i = 2;
                            while (existingProjects.some(p => p.name === `${projectName} (${i})`)) { i++; }
                            projectName = `${projectName} (${i})`;
                            startTutorialProject(tutorial, projectName);
                        }
                    });
                } else {
                    startTutorialProject(tutorial, projectName);
                }
            });
            tutorialsGrid.appendChild(card);
        });
    }

    async function startTutorialProject(tutorial, projectName) {
        if (tutorial.type === 'simulation') {
            await saveProject({ name: projectName, boardId: 'simulation', createdAt: Date.now(), modifiedAt: Date.now() });
            openProject({ name: projectName, boardId: 'simulation' });
        } else if (tutorial.type === 'hardware') {
            openNewProjectModal();
            projectNameInput.value = projectName;
            selectedProjectType = 'hardware';
            modalNextBtn.disabled = true;
            goToStep(2);
        }
    }

    function openProject(project) {
        const url = project.boardId === 'simulation'
            ? `simulation-ide.html?project=${encodeURIComponent(project.name)}`
            : `ide.html?project=${encodeURIComponent(project.name)}&board=${encodeURIComponent(project.boardId)}`;
        window.location.href = url;
    }

    // === Context Menu Logic ===
    function showContextMenu(event, project) {
        contextMenuProject = project;
        contextMenu.style.display = 'block';
        const x = Math.min(event.clientX, window.innerWidth - contextMenu.offsetWidth - 10);
        const y = Math.min(event.clientY, window.innerHeight - contextMenu.offsetHeight - 10);
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        window.addEventListener('click', hideContextMenu, { once: true });
        window.addEventListener('contextmenu', hideContextMenu, { once: true });
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
        contextMenuProject = null;
    }

    async function handleRename() {
        if (!contextMenuProject) return;
        const projectToRename = contextMenuProject; 
        hideContextMenu(); 
        const oldName = projectToRename.name;
        showCustomPrompt(`Rename project "${oldName}" to:`, oldName, async (newName) => {
            if (!newName || newName.trim() === '' || newName === oldName) return;
            newName = newName.trim();
            if ((await getAllProjects()).some(p => p.name === newName)) {
                return alert(`A project named "${newName}" already exists.`);
            }
            const workspaceData = await getWorkspace(oldName);
            const extensionsData = await getExtensions(oldName);
            await saveProject({ ...projectToRename, name: newName, modifiedAt: Date.now() });
            if (workspaceData) await saveWorkspace(newName, workspaceData);
            if (extensionsData) await saveExtensions(newName, extensionsData);
            await deleteProjectByName(oldName);
            await updateDisplayedProjects();
        });
    }
    
    async function handleDuplicate() {
        if (!contextMenuProject) return;
        const projectToDuplicate = contextMenuProject;
        hideContextMenu();
        let newName = `${projectToDuplicate.name} copy`;
        const existingProjects = await getAllProjects();
        let i = 2;
        while (existingProjects.some(p => p.name === newName)) { newName = `${projectToDuplicate.name} copy ${i++}`; }
        showCustomPrompt(`Duplicate project as:`, newName, async (finalName) => {
            if (!finalName || finalName.trim() === '') return;
            finalName = finalName.trim();
            if (existingProjects.some(p => p.name === finalName)) {
                return alert(`A project named "${finalName}" already exists.`);
            }
            const now = Date.now();
            await saveProject({ ...projectToDuplicate, name: finalName, createdAt: now, modifiedAt: now });
            const workspaceData = await getWorkspace(projectToDuplicate.name);
            const extensionsData = await getExtensions(projectToDuplicate.name);
            if (workspaceData) await saveWorkspace(finalName, workspaceData);
            if (extensionsData) await saveExtensions(finalName, extensionsData);
            await updateDisplayedProjects();
        });
    }

    function handleDelete() {
        if (!contextMenuProject) return;
        const projectToDelete = contextMenuProject;
        hideContextMenu();
        showCustomConfirm(`Are you sure you want to permanently delete "${projectToDelete.name}"?`, async (confirmed) => {
            if (confirmed) {
                await deleteProjectByName(projectToDelete.name);
                await updateDisplayedProjects();
            }
        });
    }

    // === Drag and Drop & Import Logic (UPDATED) ===
    function setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            landingContainer.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); });
        });
        landingContainer.addEventListener('dragenter', () => dragDropOverlay.style.display = 'flex');
        dragDropOverlay.addEventListener('dragleave', e => {
            if (e.relatedTarget === null || !dragDropOverlay.contains(e.relatedTarget)) {
                 dragDropOverlay.style.display = 'none';
            }
        });
        landingContainer.addEventListener('drop', e => {
            dragDropOverlay.style.display = 'none';
            if (e.dataTransfer.files.length > 0) {
                handleFileImport({ target: { files: [e.dataTransfer.files[0]] } });
            }
        });
    }

    async function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.zip')) {
            await handleZipImport(file);
        } else if (file.name.endsWith('.json')) {
            await handleJsonImport(file);
        } else {
            alert("Please import a valid .zip or .json project file.");
        }
        importFileInput.value = '';
    }
    
    async function handleZipImport(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file("project.json");
            if (!manifestFile) throw new Error("Import failed: project.json manifest not found in zip.");
            
            const manifest = JSON.parse(await manifestFile.async("string"));
            
            // The workspace now contains all code files from the zip
            const workspace = {};
            const filesInZip = Object.keys(zip.files).filter(f => f !== "project.json" && !zip.files[f].dir);
            for (const filePath of filesInZip) {
                workspace[filePath] = await zip.file(filePath).async("string");
            }
            
            // The manifest now also contains extensions and dashboard data
            await processAndSaveImportedProject({ ...manifest, workspace });

        } catch (error) {
            alert('Failed to import zip project: ' + error.message);
            console.error(error);
        }
    }

    async function handleJsonImport(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const projectData = JSON.parse(e.target.result);
                // Adapt legacy JSON to new multi-file structure
                if (projectData.workspace) { // It's a single file project
                    projectData.workspace = { "main.py": projectData.workspace };
                }
                await processAndSaveImportedProject(projectData);
            } catch (error) {
                alert('Failed to import JSON project: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
    
    async function processAndSaveImportedProject(projectData) {
        const { name, boardId, workspace, extensions, dashboard } = projectData; // Get dashboard and extensions
        if (!name || !boardId || !workspace) {
            throw new Error("File is missing required project data (name, boardId, workspace).");
        }
        const projects = await getAllProjects();
        if (projects.some(p => p.name === name)) {
            showCustomConfirm(`A project named "${name}" already exists. Overwrite it?`, async (confirmed) => {
                if (confirmed) await saveImportedProject(projectData);
            });
        } else {
            await saveImportedProject(projectData);
        }
    }

    async function saveImportedProject(projectData) {
        // We now save EVERYTHING from the imported data
        const { name, boardId, workspace, extensions, dashboard, createdAt } = projectData;
        const now = Date.now();
        
        const project = { 
            name, 
            boardId, 
            createdAt: createdAt || now, 
            modifiedAt: now,
            extensions: extensions || [],  // Save extensions with the project
            dashboard: dashboard || null  // Save dashboard state with the project
        };

        await saveProject(project);
        await saveWorkspace(name, workspace);
        // The separate saveExtensions is no longer needed as it's part of the main project object.
        
        await updateDisplayedProjects();
        alert(`Project "${name}" imported successfully!`);
    }
    
    // === New Project Modal Logic ===
    function openNewProjectModal() {
        projectNameInput.value = '';
        selectedProjectType = null;
        selectedBoardForProject = null;
        hardwareTypeCard.classList.remove('selected');
        simulationTypeCard.classList.remove('selected');
        boardGrid.querySelectorAll('.board-card').forEach(c => c.classList.remove('selected'));
        modalNextBtn.disabled = true;
        modalCreateBtn.disabled = true;
        goToStep(1);
        newProjectModal.style.display = 'flex';
        projectNameInput.focus();
    }
    function closeNewProjectModal() { newProjectModal.style.display = 'none'; }
    function goToStep(stepNum) {
        step1.classList.toggle('active', stepNum === 1);
        step2.classList.toggle('active', stepNum === 2);
    }
    function validateStep1() {
        modalNextBtn.disabled = !(projectNameInput.value.trim().length > 0 && selectedProjectType !== null);
    }
    function populateBoardSelection() {
        boardGrid.innerHTML = '';
        boards.forEach(board => {
            const card = document.createElement('div');
            card.className = 'board-card';
            card.dataset.boardId = board.id;
            card.innerHTML = `<img src="${board.image}" alt="${board.name}"><h4>${board.name}</h4>`;
            card.addEventListener('click', () => {
                document.querySelectorAll('.board-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedBoardForProject = board.id;
                modalCreateBtn.disabled = false;
            });
            boardGrid.appendChild(card);
        });
    }
    async function createNewProject() {
        const projectName = projectNameInput.value.trim();
        if (!projectName) return alert('Please enter a project name.');
        if ((await getAllProjects()).some(p => p.name === projectName)) return alert('A project with this name already exists.');
        const boardId = selectedProjectType === 'simulation' ? 'simulation' : selectedBoardForProject;
        if (!boardId) return alert('Please select a project type or board.');
        await saveProject({ name: projectName, boardId: boardId, createdAt: Date.now(), modifiedAt: Date.now() });
        openProject({ name: projectName, boardId: boardId });
    }

    // --- Main Application Initialization ---
    createProjectBtn.addEventListener('click', openNewProjectModal);
    importProjectBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleFileImport);

    blockCreatorBtn.addEventListener('click', () => { window.open('block-creator.html', '_blank'); });

    lightThemeBtn.addEventListener('click', () => setTheme('light'));
    darkThemeBtn.addEventListener('click', () => setTheme('dark'));
    contrastThemeBtn.addEventListener('click', () => setTheme('contrast'));


    searchInput.addEventListener('input', updateDisplayedProjects);
    sortSelect.addEventListener('change', updateDisplayedProjects);
    hardwareTypeCard.addEventListener('click', () => { selectedProjectType = 'hardware'; hardwareTypeCard.classList.add('selected'); simulationTypeCard.classList.remove('selected'); validateStep1(); });
    simulationTypeCard.addEventListener('click', () => { selectedProjectType = 'simulation'; simulationTypeCard.classList.add('selected'); hardwareTypeCard.classList.remove('selected'); validateStep1(); });
    projectNameInput.addEventListener('input', validateStep1);
    modalNextBtn.addEventListener('click', () => { selectedProjectType === 'hardware' ? goToStep(2) : createNewProject(); });
    modalBackBtn.addEventListener('click', () => goToStep(1));
    modalCancelBtn.addEventListener('click', closeNewProjectModal);
    modalCreateBtn.addEventListener('click', createNewProject);
    ctxRenameBtn.addEventListener('click', e => { e.stopPropagation(); handleRename(); });
    ctxDuplicateBtn.addEventListener('click', e => { e.stopPropagation(); handleDuplicate(); });
    ctxDeleteBtn.addEventListener('click', e => { e.stopPropagation(); handleDelete(); });


    // Initial load
    setupCardHoverEffects();
    updateDisplayedProjects();
    renderExampleCards();
    renderTutorialCards();
    populateBoardSelection();
    setupDragAndDrop();
    applyTheme();

     const TOUR_FLAG_KEY = 'hasSeenLandingTour';
    
    // Use a timeout to ensure the page has fully rendered before starting the tour
    setTimeout(() => {
        if (!localStorage.getItem(TOUR_FLAG_KEY)) {
            const tour = new Shepherd.Tour({
                useModalOverlay: true,
                defaultStepOptions: {
                    cancelIcon: { enabled: true },
                    classes: 'shadow-md',
                    scrollTo: { behavior: 'smooth', block: 'center' }
                }
            });

            tour.addSteps(landingTourSteps);

            // When the tour is finished or cancelled, set the flag in localStorage
            tour.on('complete', () => localStorage.setItem(TOUR_FLAG_KEY, 'true'));
            tour.on('cancel', () => localStorage.setItem(TOUR_FLAG_KEY, 'true'));

            tour.start();
        }
    }, 500); // 500ms delay


    function setupCardHoverEffects() {
    const grid = document.querySelector('.projects-grid');
    grid.addEventListener('mousemove', e => {
        if (e.target.classList.contains('project-card')) {
            const card = e.target;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // For the glow effect
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);

            // For the 3D tilt effect
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20; // Adjust divisor for sensitivity
            const rotateY = (centerX - x) / 20;
            card.style.transform = `scale(1.03) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        }
    });

    grid.addEventListener('mouseleave', () => {
        const cards = grid.querySelectorAll('.project-card');
        cards.forEach(card => {
            card.style.transform = 'scale(1) rotateX(0deg) rotateY(0deg)';
        });
    });
}

});