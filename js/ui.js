/**
 * ui.js - UI management and event handlers
 * Functions for handling the user interface elements and interactions
 */

import { createNote } from './notes.js';
import { saveNotes, exportNotesAsJson } from './storage.js';

/**
 * Initialize UI event listeners
 * @param {NoteManager} noteManager - The note manager instance
 */
export function initializeUI(noteManager) {
    const noteBoard = document.getElementById('note-board');
    const exportBtn = document.getElementById('export-btn');
    const ascendingBtn = document.getElementById('sort-asc-btn');
    const descendingBtn = document.getElementById('sort-desc-btn');

    // Double click on board to create a new note
    noteBoard.addEventListener('dblclick', (event) => {
        // Only create note if we clicked directly on the board, not on an existing note
        if (event.target === noteBoard) {
            createNewNote(event.clientX, event.clientY, noteManager);
        }
    });

    // Export button click handler
    exportBtn.addEventListener('click', () => {
        exportNotes(noteManager);
    });

    ascendingBtn.addEventListener('click', () => {
        sortNotes(noteManager, 'asc');
    });

    descendingBtn.addEventListener('click', () => {
        sortNotes(noteManager, 'desc');
    });

    // Setup auto-save timer
    setupAutoSave(noteManager);
}

/**
 * Create a new note at the specified position
 * @param {number} x - X position for the new note
 * @param {number} y - Y position for the new note
 * @param {NoteManager} noteManager - The note manager instance
 */
export function createNewNote(x, y, noteManager) {
    // Calculate position relative to the board
    const noteBoard = document.getElementById('note-board');
    const boardRect = noteBoard.getBoundingClientRect();
    
    const boardX = x - boardRect.left;
    const boardY = y - boardRect.top;
    
    // Create the new note
    const note = createNote({
        content: '',
        x: boardX,
        y: boardY
    });
    
    // Add to manager
    noteManager.addNote(note);
    
    // Create DOM element
    const noteElement = note.createElement();
    
    // Add event listeners to the note
    setupNoteEventListeners(noteElement, note, noteManager);
    
    // Add to board
    noteBoard.appendChild(noteElement);
    
    // Focus the content area for immediate editing
    const contentElement = noteElement.querySelector('.note-content');
    contentElement.focus();
    
    return note;
}

/**
 * Set up event listeners for a note element
 * @param {HTMLElement} noteElement - The note DOM element
 * @param {Note} note - The note object
 * @param {NoteManager} noteManager - The note manager instance
 */
export function setupNoteEventListeners(noteElement, note, noteManager) {
    // Get elements
    const contentElement = noteElement.querySelector('.note-content');
    const deleteButton = noteElement.querySelector('.delete-btn');
    const quoteButton = noteElement.querySelector('.quote-btn');
    
    // Track whether the note is being dragged
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    
    // Content change handler
    contentElement.addEventListener('input', () => {
        note.updateContent(contentElement.textContent);
    });
    
    // Delete button handler
    deleteButton.addEventListener('click', () => {
        deleteNote(noteElement, note, noteManager);
    });
    
    // Quote button handler
    quoteButton.addEventListener('click', async () => {
        try {
            quoteButton.textContent = '⌛'; // Show loading indicator
            await note.addRandomQuote();
            quoteButton.textContent = '💡'; // Restore original icon
        } catch (error) {
            // Show error indicator briefly
            quoteButton.textContent = '❌';
            setTimeout(() => {
                quoteButton.textContent = '💡';
            }, 1500);
            
            // Display error in console
            console.error('Failed to fetch quote:', error);
        }
    });
    
    // Drag start
    noteElement.addEventListener('mousedown', (event) => {
        // Ignore if clicking on buttons or content area
        if (event.target === deleteButton || 
            event.target === quoteButton ||
            event.target === contentElement) {
            return;
        }
        
        // Start dragging
        isDragging = true;
        
        // Calculate offset from note's top-left corner
        const noteRect = noteElement.getBoundingClientRect();
        dragOffsetX = event.clientX - noteRect.left;
        dragOffsetY = event.clientY - noteRect.top;
        
        // Add active class for styling
        noteElement.classList.add('note-active');
        
        // Prevent text selection during drag
        event.preventDefault();
    });
    
    // Dragging image over note
    noteElement.addEventListener('dragover', (event) => {
        event.preventDefault();
        noteElement.classList.add('note-drag-over'); // optional highlight
    });

    // Dragging image away from note
    noteElement.addEventListener('dragleave', () => {
        noteElement.classList.remove('note-drag-over');
    });

    // Dropped/Released image over note
    noteElement.addEventListener('drop', async (event) => {
        event.preventDefault();
        noteElement.classList.remove('note-drag-over');

        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const fileReader = new FileReader();
            fileReader.onload = () => {
                note.image = fileReader.result;
                const img = document.createElement('img');
                img.src = fileReader.result;
                img.alt = "Image";
                img.classList.add('note-image');

                const contentElement = noteElement.querySelector('.note-content');
                noteElement.insertBefore(img, contentElement);
            };
            fileReader.readAsDataURL(file);
        }
    });

    // Drag move
    document.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        
        // Get board position and dimensions
        const noteBoard = document.getElementById('note-board');
        const boardRect = noteBoard.getBoundingClientRect();
        
        // Calculate new position relative to board
        let newX = event.clientX - boardRect.left - dragOffsetX;
        let newY = event.clientY - boardRect.top - dragOffsetY;
        
        // Keep note within board boundaries
        newX = Math.max(0, Math.min(newX, boardRect.width - noteElement.offsetWidth));
        newY = Math.max(0, Math.min(newY, boardRect.height - noteElement.offsetHeight));
        
        // Update note position
        note.updatePosition(newX, newY);
    });
    
    // Drag end
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            noteElement.classList.remove('note-active');
        }
    });
}

/**
 * Delete a note
 * @param {HTMLElement} noteElement - The note DOM element
 * @param {Note} note - The note object
 * @param {NoteManager} noteManager - The note manager instance
 */
export function deleteNote(noteElement, note, noteManager) {
    // Add fade-out animation
    noteElement.classList.add('note-fade-out');
    
    // Remove after animation completes
    noteElement.addEventListener('animationend', () => {
        // Remove from DOM
        noteElement.remove();
        
        // Remove from manager
        noteManager.removeNote(note.id);
    });
}

/**
 * Export all notes as JSON file
 * @param {NoteManager} noteManager - The note manager instance
 */
export function exportNotes(noteManager) {
    const notes = noteManager.toJSON();
    exportNotesAsJson(notes);
}

/**
 * Sort and relocate notes
 * @param {NoteManager} noteManager - The note manager instance
 * @param {string} order - String representing desired order.
 */
export function sortNotes(noteManager, order = 'asc') {
    const noteBoard = document.getElementById('note-board');
    const noteWidth = 200;
    const padding = 15;
    const edgePadding = 15;
    const columns = Math.floor(noteBoard.clientWidth / (noteWidth + padding));
    
    noteBoard.innerHTML = '';

    const sortedNotes = noteManager.getAllNotes().sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return order === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const noteElements = sortedNotes.map((note) => {
        const element = note.createElement();
        setupNoteEventListeners(element, note, noteManager);
        noteBoard.appendChild(element);
        return { note, element: element };
    });

    let yOffset = edgePadding;

    for (let i = 0; i < noteElements.length; i += columns) {
        const rowNotes = noteElements.slice(i, i + columns);
        const rowHeight = Math.max(...rowNotes.map(n => n.element.offsetHeight));

        rowNotes.forEach((n, j) => {
            const x = edgePadding + j * (noteWidth + padding);
            const y = yOffset;

            n.note.updatePosition(x, y);

            n.element.style.position = 'absolute';
            n.element.style.left = `${x}px`;
            n.element.style.top = `${y}px`;
        });
        yOffset += rowHeight + padding;
    }
    noteBoard.style.height = `${yOffset + edgePadding}px`;

    const notes = noteManager.toJSON();
    saveNotes(notes);
}

/**
 * Setup auto-save functionality
 * @param {NoteManager} noteManager - The note manager instance
 */
export function setupAutoSave(noteManager) {
    // Save every 5 seconds if there are changes
    setInterval(() => {
        const notes = noteManager.toJSON();
        saveNotes(notes);
    }, 5000);
}

/**
 * Render all notes from manager to the board
 * @param {NoteManager} noteManager - The note manager instance
 */
export function renderAllNotes(noteManager) {
    const noteBoard = document.getElementById('note-board');
    
    // Clear existing notes
    const existingNotes = noteBoard.querySelectorAll('.note');
    existingNotes.forEach(noteElement => {
        noteElement.remove();
    });
    
    // Render all notes
    noteManager.getAllNotes().forEach(note => {
        const noteElement = note.createElement();
        setupNoteEventListeners(noteElement, note, noteManager);
        noteBoard.appendChild(noteElement);
    });
}
