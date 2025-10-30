import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  addDoc, 
  collection, 
  query, 
  onSnapshot, 
  serverTimestamp,
  setLogLevel,
  deleteDoc,
  where // <-- Import 'where' here
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase & App Initialization ---

// Enable debug logging for Firestore
setLogLevel('Debug');

//
// ***************************************************************
// * PASTE YOUR FIREBASE CONFIG HERE
// *
// * 1. Go to https://firebase.google.com/ and create a project.
// * 2. Add a Web App (</>) to your project.
// * 3. Copy the `firebaseConfig` object given to you.
// * 4. Paste it here, replacing the placeholder object.
// *
// ***************************************************************
const firebaseConfig = {
  apiKey: "AIzaSyC-ri85nqnJGvrrj775WuejX-QwPAY_Gy8",
  authDomain: "fitness-tracker-995c6.firebaseapp.com",
  projectId: "fitness-tracker-995c6",
  storageBucket: "fitness-tracker-995c6.firebasestorage.app",
  messagingSenderId: "130310968795",
  appId: "1:130310968795:web:34cff6a756705cb8da03fe",
  measurementId: "G-VWVW12CGLV"
};

// Initialize Firebase
let app, db, auth;
let userId = null;
let workoutCollectionRef = null;
let templateCollectionRef = null;
let chartInstance = null; // To hold the chart object
let allWorkouts = []; // To store history data for graphing
let workoutToDelete = null; // Variable to store ID for deletion confirmation
let isFirstHistoryLoad = true; // Flag for efficient history loading
let isFirstTemplateLoad = true; // Flag for efficient template loading

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("Firebase Initialized Successfully");
} catch (e) {
  console.error("Error initializing Firebase: ", e);
  // We can't access app-container here, so we'll handle this inside DOMContentLoaded
}

// Wait for the DOM to be fully loaded before running script
document.addEventListener('DOMContentLoaded', () => {

  // --- DOM Element References ---
  const appContainer = document.getElementById('app-container');
  const tabLog = document.getElementById('tab-log');
  const tabHistory = document.getElementById('tab-history');
  const tabTemplates = document.getElementById('tab-templates');
  const tabProgress = document.getElementById('tab-progress');
  const logView = document.getElementById('log-view');
  const historyView = document.getElementById('history-view');
  const templatesView = document.getElementById('templates-view');
  const progressView = document.getElementById('progress-view');
  const addExerciseBtn = document.getElementById('add-exercise-btn');
  const currentWorkoutList = document.getElementById('current-workout-list');
  const saveWorkoutBtn = document.getElementById('save-workout-btn');
  const workoutDateInput = document.getElementById('workout-date');
  const historyListContainer = document.getElementById('history-list-container');
  const templatesListContainer = document.getElementById('templates-list-container');
  
  // Modal elements
  const messageModal = document.getElementById('message-modal');
  const messageText = document.getElementById('message-text');
  const closeMessageBtn = document.getElementById('close-message-btn');
  
  const savePresetModal = document.getElementById('save-preset-modal');
  const closePresetModalBtn = document.getElementById('close-preset-modal-btn');
  const confirmSavePresetBtn = document.getElementById('confirm-save-preset-btn');
  const presetNameInput = document.getElementById('preset-name-input');
  
  // New Delete Confirmation Modal elements
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const deleteConfirmText = document.getElementById('delete-confirm-text');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  
  const userIdDisplay = document.getElementById('user-id-display');
  
  // New Preset Elements
  const savePresetBtn = document.getElementById('save-preset-btn');
  const loadPresetSelect = document.getElementById('load-preset-select');

  // New Progress View Elements
  const progressExerciseSelect = document.getElementById('progress-exercise-select');
  const progressMetricSelect = document.getElementById('progress-metric-select');
  
  // --- HTML Template References ---
  const exerciseTemplate = document.getElementById('exercise-template');
  const setItemTemplate = document.getElementById('set-item-template');

  // Check for initialization errors
  if (!app || firebaseConfig.apiKey === "YOUR_API_KEY") {
    let errorMsg = !app 
      ? "Error initializing application. Please check console."
      : "Firebase is not configured. Please paste your `firebaseConfig` object into the script tag.";
    
    appContainer.innerHTML = `<p class="text-red-400 p-4 bg-red-900 rounded-lg">${errorMsg}</p>`;
    console.error(errorMsg);
    return; // Stop execution
  }

  // --- Authentication ---

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("User is signed in:", user.uid);
      userId = user.uid;
      userIdDisplay.textContent = userId;
      
      // Define the user-specific collection path
      // We use a general "workouts" collection and filter by userId
      workoutCollectionRef = collection(db, 'standalone_workouts');
      templateCollectionRef = collection(db, 'standalone_templates');
      
      // Load data now that we are authenticated
      loadWorkoutHistory();
      loadWorkoutTemplates();

    } else {
      console.log("No user found, attempting anonymous sign-in...");
      userIdDisplay.textContent = 'Signing in...';
      try {
        // In a standalone app, we MUST use anonymous sign-in
        // as there is no custom token provided.
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Authentication Error: ", error);
        userIdDisplay.textContent = 'Auth Error';
      }
    }
  });

  // --- View Switching ---

  function showView(view) {
    logView.classList.add('hidden');
    historyView.classList.add('hidden');
    templatesView.classList.add('hidden');
    progressView.classList.add('hidden');
    
    tabLog.classList.remove('border-b-2', 'border-amber-500', 'text-amber-500');
    tabHistory.classList.remove('border-b-2', 'border-amber-500', 'text-amber-500');
    tabTemplates.classList.remove('border-b-2', 'border-amber-500', 'text-amber-500');
    tabProgress.classList.remove('border-b-2', 'border-amber-500', 'text-amber-500');
    tabLog.classList.add('text-gray-400');
    tabHistory.classList.add('text-gray-400');
    tabTemplates.classList.add('text-gray-400');
    tabProgress.classList.add('text-gray-400');

    if (view === 'log') {
      logView.classList.remove('hidden');
      tabLog.classList.add('border-b-2', 'border-amber-500', 'text-amber-500');
      tabLog.classList.remove('text-gray-400');
    } else if (view === 'history') {
      historyView.classList.remove('hidden');
      tabHistory.classList.add('border-b-2', 'border-amber-500', 'text-amber-500');
      tabHistory.classList.remove('text-gray-400');
    } else if (view === 'templates') {
      templatesView.classList.remove('hidden');
      tabTemplates.classList.add('border-b-2', 'border-amber-500', 'text-amber-500');
      tabTemplates.classList.remove('text-gray-400');
    } else if (view === 'progress') {
      progressView.classList.remove('hidden');
      tabProgress.classList.add('border-b-2', 'border-amber-500', 'text-amber-500');
      tabProgress.classList.remove('text-gray-400');
      // Draw chart when view is shown
      drawProgressChart(); 
    }
  }

  tabLog.addEventListener('click', () => showView('log'));
  tabHistory.addEventListener('click', () => showView('history'));
  tabTemplates.addEventListener('click', () => showView('templates'));
  tabProgress.addEventListener('click', () => showView('progress'));

  // --- Utility Functions ---

  function showMessage(message) {
    messageText.textContent = message;
    messageModal.classList.remove('hidden');
  }

  closeMessageBtn.addEventListener('click', () => {
    messageModal.classList.add('hidden');
  });

  closePresetModalBtn.addEventListener('click', () => {
    savePresetModal.classList.add('hidden');
    presetNameInput.value = '';
  });

  // --- Log Workout Logic ---

  // Set default date to today
  workoutDateInput.valueAsDate = new Date();

  // Add a new blank exercise form
  addExerciseBtn.addEventListener('click', () => {
    const exerciseId = `ex-${Date.now()}`;
    
    // Clone the template
    const templateContent = exerciseTemplate.content.cloneNode(true);
    const newExercise = templateContent.querySelector('.exercise-item');
    newExercise.id = exerciseId;
    
    // Append the cloned node
    currentWorkoutList.appendChild(newExercise);
    
    // Add a default set to the new strength exercise
    addSet(newExercise.querySelector('.sets-list'));
  });

  // Handle dynamic events (add set, remove exercise, change type) using event delegation
  currentWorkoutList.addEventListener('click', (e) => {
    // Add Set
    if (e.target.classList.contains('add-set-btn')) {
      e.preventDefault();
      const setsList = e.target.previousElementSibling;
      addSet(setsList);
    }
    
    // Remove Set
    if (e.target.closest('.remove-set-btn')) {
      e.preventDefault();
      e.target.closest('.set-item').remove();
    }

    // Remove Exercise
    if (e.target.closest('.remove-exercise-btn')) {
      e.preventDefault();
      e.target.closest('.exercise-item').remove();
    }
  });
  
  currentWorkoutList.addEventListener('change', (e) => {
    // Change Exercise Type
    if (e.target.classList.contains('exercise-type-select')) {
      const exerciseItem = e.target.closest('.exercise-item');
      const strengthInputs = exerciseItem.querySelector('.strength-inputs');
      const cardioInputs = exerciseItem.querySelector('.cardio-inputs');
      
      if (e.target.value === 'strength') {
        strengthInputs.classList.remove('hidden');
        cardioInputs.classList.add('hidden');
      } else {
        strengthInputs.classList.add('hidden');
        cardioInputs.classList.remove('hidden');
      }
    }
  });

  // Function to add a new set input row
  function addSet(setsListContainer) {
    // Clone the set template
    const templateContent = setItemTemplate.content.cloneNode(true);
    setsListContainer.appendChild(templateContent);
  }

  // --- Save Workout & Template Logic ---

  // Helper function to get current exercises from the form
  function getCurrentExercisesFromForm() {
    const exercises = [];
    const exerciseItems = currentWorkoutList.querySelectorAll('.exercise-item');
    let valid = true;

    if (exerciseItems.length === 0) {
      return { valid: false, exercises: [], message: "Please add at least one exercise." };
    }

    exerciseItems.forEach(item => {
      const name = item.querySelector('.exercise-name').value;
      const type = item.querySelector('.exercise-type-select').value;
      
      if (!name) {
        valid = false;
      }

      const exerciseData = { name, type };

      if (type === 'strength') {
        exerciseData.sets = [];
        item.querySelectorAll('.set-item').forEach(setItem => {
          const weight = setItem.querySelector('.set-weight').value;
          const reps = setItem.querySelector('.set-reps').value;
          exerciseData.sets.push({ 
            weight: parseFloat(weight) || 0, 
            reps: parseInt(reps) || 0 
          });
        });
      } else {
        const duration = item.querySelector('.cardio-duration').value;
        const distance = item.querySelector('.cardio-distance').value;
        exerciseData.duration = parseFloat(duration) || 0;
        exerciseData.distance = parseFloat(distance) || 0;
      }
      exercises.push(exerciseData);
    });
    
    if (!valid) {
      return { valid: false, exercises: [], message: "Please enter a name for all exercises." };
    }

    return { valid: true, exercises: exercises };
  }

  // Save workout to Firestore
  saveWorkoutBtn.addEventListener('click', async () => {
    if (!workoutCollectionRef || !userId) {
      showMessage("Error: Not connected to database.");
      return;
    }

    const workoutDate = workoutDateInput.value; 
    if (!workoutDate) {
      showMessage("Please select a date.");
      return;
    }

    const { valid, exercises, message } = getCurrentExercisesFromForm();

    if (!valid) {
      showMessage(message);
      return;
    }

    // Save to Firestore
    try {
      saveWorkoutBtn.disabled = true;
      saveWorkoutBtn.textContent = 'Saving...';
      
      await addDoc(workoutCollectionRef, {
        ownerId: userId, // <-- IMPORTANT: Tag data with user ID
        date: workoutDate,
        exercises: exercises,
        createdAt: serverTimestamp() // Used for reliable sorting
      });

      showMessage("Workout saved successfully!");
      currentWorkoutList.innerHTML = ''; // Clear the form
      workoutDateInput.valueAsDate = new Date(); // Reset date
    
    } catch (error) {
      console.error("Error saving workout: ", error);
      showMessage("Error: Could not save workout. Check Firestore rules.");
    } finally {
      saveWorkoutBtn.disabled = false;
      saveWorkoutBtn.textContent = 'Save Workout';
    }
  });

  // Open "Save as Preset" modal
  savePresetBtn.addEventListener('click', () => {
    const { valid, exercises } = getCurrentExercisesFromForm();
    
    if (!valid || exercises.length === 0) {
      showMessage("Please add at least one exercise with a name to save a preset.");
      return;
    }
    
    // Show the modal
    presetNameInput.value = '';
    savePresetModal.classList.remove('hidden');
    presetNameInput.focus();
  });

  // Confirm saving the preset from the modal
  confirmSavePresetBtn.addEventListener('click', async () => {
    const templateName = presetNameInput.value;
    if (!templateName) {
      showMessage("Please enter a name for the preset.");
      return;
    }

    if (!templateCollectionRef || !userId) {
      showMessage("Error: Not connected to database.");
      return;
    }
    
    const { valid, exercises } = getCurrentExercisesFromForm();

    if (!valid) {
      showMessage("Cannot save preset, form is invalid.");
      return;
    }

    try {
      confirmSavePresetBtn.disabled = true;
      confirmSavePresetBtn.textContent = 'Saving...';
      
      await addDoc(templateCollectionRef, {
        ownerId: userId, // <-- IMPORTANT: Tag data with user ID
        templateName: templateName,
        exercises: exercises,
        createdAt: serverTimestamp()
      });

      showMessage("Preset saved successfully!");
      savePresetModal.classList.add('hidden');
      presetNameInput.value = '';

    } catch (error) {
      console.error("Error saving preset: ", error);
      showMessage("Error: Could not save preset. Check Firestore rules.");
    } finally {
      confirmSavePresetBtn.disabled = false;
      confirmSavePresetBtn.textContent = 'Save Preset';
    }
  });

  
  // --- History View Logic ---
  
  function loadWorkoutHistory() {
    if (!workoutCollectionRef || !userId) {
      historyListContainer.innerHTML = '<p class="text-gray-400">Connecting to database...</p>';
      return;
    }

    historyListContainer.innerHTML = '<p class="text-gray-400">Loading workout history...</p>';

    //
    // ***************************************************************
    // * IMPORTANT: This query requires Firestore Security Rules
    // *
    // * You MUST set up Firestore rules to allow this read.
    // * Go to your Firebase project > Firestore > Rules and set:
    // *
    // * service cloud.firestore {
    // * match /databases/{database}/documents {
    // * // Allow users to read/write ONLY their own data
    // * match /standalone_workouts/{docId} {
    // * allow read, write, delete: if request.auth.uid == resource.data.ownerId;
    // * }
    // * match /standalone_templates/{docId} {
    // * allow read, write, delete: if request.auth.uid == resource.data.ownerId;
    // * }
    // * // Allow users to CREATE data
    // * match /standalone_workouts/{docId} {
    // * allow create: if request.auth.uid == request.resource.data.ownerId;
    // * }
    // * match /standalone_templates/{docId} {
    // * allow create: if request.auth.uid == request.resource.data.ownerId;
    // * }
    // * }
    // * }
    // *
    // ***************************************************************
    //
    // Use the 'where' function imported at the top of the module
    const q = query(workoutCollectionRef, where("ownerId", "==", userId));
    isFirstHistoryLoad = true;
    historyListContainer.innerHTML = '<p class="text-gray-400">Loading workout history...</p>';

    onSnapshot(q, (snapshot) => {
      // Update allWorkouts array for the progress graph
      allWorkouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allWorkouts.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      
      populateProgressExerciseSelect(allWorkouts); // Populate graph dropdown

      // Handle empty state
      if (snapshot.empty) {
        historyListContainer.innerHTML = '<p class="text-gray-400">No workouts saved yet. Go log one!</p>';
        return;
      }

      // On first load, render everything efficiently
      if (isFirstHistoryLoad) {
        isFirstHistoryLoad = false;
        let html = '';
        // We use the sorted allWorkouts array to render in the correct order
        allWorkouts.forEach(workout => {
          html += createHistoryItemHTML(workout);
        });
        historyListContainer.innerHTML = html;
      } else {
        // On subsequent updates, just process the changes
        snapshot.docChanges().forEach((change) => {
          const workout = { id: change.doc.id, ...change.doc.data() };
          const workoutId = `workout-${workout.id}`;

          if (change.type === 'added') {
            const newWorkoutHtml = createHistoryItemHTML(workout);
            // Find where to insert it based on date
            const existingItems = historyListContainer.querySelectorAll('.workout-history-item');
            let inserted = false;
            for (const item of existingItems) {
              const itemDate = item.dataset.date;
              if (workout.date > itemDate) {
                item.insertAdjacentHTML('beforebegin', newWorkoutHtml);
                inserted = true;
                break;
              }
            }
            if (!inserted) {
              historyListContainer.insertAdjacentHTML('beforeend', newWorkoutHtml);
            }
            // Remove "empty" message if it's there
            const p = historyListContainer.querySelector('p');
            if (p) p.remove();

          } else if (change.type === 'modified') {
            const existingEl = document.getElementById(workoutId);
            if (existingEl) {
              existingEl.outerHTML = createHistoryItemHTML(workout); // Replace it
            }
          } else if (change.type === 'removed') {
            const existingEl = document.getElementById(workoutId);
            if (existingEl) {
              existingEl.remove();
            }
            if (historyListContainer.children.length === 0) {
              historyListContainer.innerHTML = '<p class="text-gray-400">No workouts saved yet. Go log one!</p>';
            }
          }
        });
      }
    }, (error) => {
      console.error("Error loading history: ", error);
      historyListContainer.innerHTML = `<p class="text-red-400">Error loading workout history. Did you set the <strong class="font-bold">Firestore Security Rules</strong>?</p>`;
      isFirstHistoryLoad = true; // Reset on error
    });
  }

  // New helper function to create HTML for a single history item
  function createHistoryItemHTML(workout) {
    const d = new Date(workout.date + 'T00:00:00'); // Ensure correct local date parsing
    const displayDate = d.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let html = `
      <div id="workout-${workout.id}" class="workout-history-item bg-gray-800 p-4 rounded-lg shadow-md mb-4 relative" data-date="${workout.date}">
        <button class="delete-workout-btn absolute top-3 right-3 text-red-500 hover:text-red-400 p-1" data-id="${workout.id}" data-date="${displayDate}" title="Delete Workout">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        
        <h3 class="text-lg font-bold text-amber-500">${displayDate}</h3>
        <ul class="mt-2 space-y-2">
    `;

    workout.exercises.forEach(ex => {
      html += `<li class="border-t border-gray-700 pt-2">
        <p class="text-md font-semibold text-white">${ex.name} <span class="text-xs font-normal text-gray-400">(${ex.type})</span></p>
      `;

      if (ex.type === 'strength') {
        html += '<ul class="pl-4 mt-1 text-sm text-gray-300">';
        ex.sets.forEach((set, index) => {
          html += `<li>Set ${index + 1}: ${set.weight} lbs x ${set.reps} reps</li>`;
        });
        html += '</ul>';
      } else {
        html += '<p class="pl-4 mt-1 text-sm text-gray-300">';
        if (ex.duration) html += `${ex.duration} minutes `;
        if (ex.distance) html += ` / ${ex.distance} mi/km`;
        html += '</p>';
      }
      html += '</li>';
    });

    html += `
        </ul>
      </div>
    `;
    return html;
  }
  
  // --- History Deletion Logic ---
  
  historyListContainer.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-workout-btn');
    if (deleteBtn) {
      workoutToDelete = deleteBtn.dataset.id;
      const workoutDate = deleteBtn.dataset.date;
      deleteConfirmText.textContent = `Are you sure you want to delete the workout from ${workoutDate}? This action cannot be undone.`;
      deleteConfirmModal.classList.remove('hidden');
    }
  });

  cancelDeleteBtn.addEventListener('click', () => {
    deleteConfirmModal.classList.add('hidden');
    workoutToDelete = null;
  });

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!workoutToDelete) return;

    try {
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Deleting...';
      
      // Note: We use workoutCollectionRef (the base collection) and provide the full path
      const docRef = doc(db, 'standalone_workouts', workoutToDelete);
      await deleteDoc(docRef);
      
      showMessage("Workout deleted successfully.");

    } catch (error) {
      console.error("Error deleting workout: ", error);
      showMessage("Error: Could not delete workout.");
    } finally {
      deleteConfirmModal.classList.add('hidden');
      workoutToDelete = null;
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Confirm Delete';
    }
  });


  // --- Template (Preset) Logic ---

  async function loadWorkoutTemplates() {
    if (!templateCollectionRef || !userId) {
      return;
    }
    
    isFirstTemplateLoad = true;
    
    // Use the 'where' function imported at the top of the module
    const q = query(templateCollectionRef, where("ownerId", "==", userId));

    onSnapshot(q, (snapshot) => {
      // Full data replacement for the dropdown
      let templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      templates.sort((a, b) => a.templateName.localeCompare(b.templateName));
      renderTemplateDropdown(templates);

      // Handle empty state
      if (snapshot.empty) {
        templatesListContainer.innerHTML = '<p class="text-gray-400">No presets saved yet.</p>';
        return;
      }

      // Efficient DOM updates for the Template View
      if (isFirstTemplateLoad) {
        isFirstTemplateLoad = false;
        let html = '';
        templates.forEach(template => {
          html += createTemplateItemHTML(template);
        });
        templatesListContainer.innerHTML = html;
      } else {
        snapshot.docChanges().forEach((change) => {
          const template = { id: change.doc.id, ...change.doc.data() };
          const templateId = `template-${template.id}`;

          if (change.type === 'added') {
            const newTemplateHtml = createTemplateItemHTML(template);
            // Find where to insert it based on name
            const existingItems = templatesListContainer.querySelectorAll('.template-item');
            let inserted = false;
            for (const item of existingItems) {
              const itemName = item.dataset.name;
              if (template.templateName.localeCompare(itemName) < 0) {
                item.insertAdjacentHTML('beforebegin', newTemplateHtml);
                inserted = true;
                break;
              }
            }
            if (!inserted) {
              templatesListContainer.insertAdjacentHTML('beforeend', newTemplateHtml);
            }
            const p = templatesListContainer.querySelector('p');
            if (p) p.remove();

          } else if (change.type === 'modified') {
            const existingEl = document.getElementById(templateId);
            if (existingEl) {
              existingEl.outerHTML = createTemplateItemHTML(template); // Replace it
            }
          } else if (change.type === 'removed') {
            const existingEl = document.getElementById(templateId);
            if (existingEl) {
              existingEl.remove();
            }
            if (templatesListContainer.children.length === 0) {
              templatesListContainer.innerHTML = '<p class="text-gray-400">No presets saved yet.</p>';
            }
          }
        });
      }

    }, (error) => {
      console.error("Error loading templates: ", error);
      templatesListContainer.innerHTML = `<p class="text-red-400">Error loading templates. Did you set the <strong class="font-bold">Firestore Security Rules</strong>?</p>`;
      isFirstTemplateLoad = true; // Reset on error
    });
  }

  function renderTemplateDropdown(templates) {
    let html = '<option value="">-- Load from Preset --</option>';
    templates.forEach(template => {
      // Store exercises in data attribute, escaping single quotes
      const exercisesJson = JSON.stringify(template.exercises).replace(/'/g, '&apos;');
      html += `<option value="${template.id}" data-exercises='${exercisesJson}'>
        ${template.templateName}
      </option>`;
    });
    loadPresetSelect.innerHTML = html;
  }
  
  // New helper function to create HTML for a single template item
  function createTemplateItemHTML(template) {
    const exercisesJson = JSON.stringify(template.exercises).replace(/'/g, '&apos;');
      
    let html = `
      <div id="template-${template.id}" class="template-item bg-gray-800 p-4 rounded-lg shadow-md" data-name="${template.templateName}">
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-bold text-white">${template.templateName}</h3>
            <button class="delete-preset-btn text-red-500 hover:text-red-400 p-1" data-id="${template.id}" title="Delete Preset">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
          <ul class="pl-4 space-y-1 list-disc list-inside text-sm text-gray-300 mb-4">
    `;

    template.exercises.forEach(ex => {
      html += `<li>${ex.name} (${ex.type})</li>`;
    });

    html += `
        </ul>
        <button class="load-preset-from-view-btn w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 px-4 rounded-lg" data-exercises='${exercisesJson}'>
          Load Preset
        </button>
      </div>
    `;
    return html;
  }

  // Handle loading a preset from the dropdown
  loadPresetSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    if (!selectedOption.value) return;

    const exercises = JSON.parse(selectedOption.dataset.exercises.replace(/&apos;/g, "'"));
    populateWorkoutForm(exercises);
    
    // Reset dropdown
    e.target.value = '';
  });

  // Handle events in the Templates view
  templatesListContainer.addEventListener('click', async (e) => {
    // Load Preset
    const loadBtn = e.target.closest('.load-preset-from-view-btn');
    if (loadBtn) {
      const exercises = JSON.parse(loadBtn.dataset.exercises.replace(/&apos;/g, "'"));
      populateWorkoutForm(exercises);
      showView('log'); // Switch to log view
      return;
    }

    // Delete Preset
    const deleteBtn = e.target.closest('.delete-preset-btn');
    if (deleteBtn) {
      const templateId = deleteBtn.dataset.id;
      if (templateId) {
        // Note: In a real app, you'd add a confirmation modal here too.
        try {
          const docRef = doc(db, 'standalone_templates', templateId);
          await deleteDoc(docRef);
          showMessage("Template deleted.");
        } catch (error) {
          console.error("Error deleting template: ", error);
          showMessage("Error: Could not delete template.");
        }
      }
    }
  });

  // --- Progress Graph Logic ---

  // New helper function to calculate 1-Rep Max
  // Using the Brzycki formula
  function calculate1RM(weight, reps) {
    if (reps <= 0 || weight <= 0) return 0;
    if (reps === 1) return weight;
    // Formula is less accurate for high reps, but we'll apply it
    return weight / (1.0278 - (0.0278 * reps));
  }

  function populateProgressExerciseSelect(workouts) {
    const exercisesMap = new Map();
    workouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        if (!exercisesMap.has(ex.name)) {
          exercisesMap.set(ex.name, ex.type);
        }
      });
    });

    if (exercisesMap.size === 0) {
      progressExerciseSelect.innerHTML = '<option value="">No exercises logged</option>';
      return;
    }

    let html = '<option value="">-- Select Exercise --</option>';
    exercisesMap.forEach((type, name) => {
      html += `<option value="${name}" data-type="${type}">${name}</option>`;
    });
    progressExerciseSelect.innerHTML = html;

    // Auto-populate metrics for the first exercise if available
    if (exercisesMap.size > 0) {
      const firstType = exercisesMap.values().next().value;
      populateProgressMetricSelect(firstType);
    }
  }

  function populateProgressMetricSelect(exerciseType) {
    let html = '';
    if (exerciseType === 'strength') {
      html = `
        <option value="maxWeight">Calculated 1-Rep Max (lbs)</option>
        <option value="totalVolume">Total Volume (Weight x Reps)</option>
        <option valueVlue="maxReps">Max Reps</option>
      `;
    } else if (exerciseType === 'cardio') {
      html = `
        <option value="duration">Duration (min)</option>
        <option value="distance">Distance (mi/km)</option>
      `;
    }
    progressMetricSelect.innerHTML = html;
  }

  progressExerciseSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    if (selectedOption.value) {
      const type = selectedOption.dataset.type;
      populateProgressMetricSelect(type);
    } else {
      progressMetricSelect.innerHTML = '';
    }
    drawProgressChart();
  });

  progressMetricSelect.addEventListener('change', drawProgressChart);

  function drawProgressChart() {
    const selectedExercise = progressExerciseSelect.value;
    const selectedMetric = progressMetricSelect.value;

    if (chartInstance) {
      chartInstance.destroy(); // Destroy old chart before drawing new one
    }

    if (!selectedExercise || !selectedMetric) {
      return; // Don't draw if nothing is selected
    }

    const labels = [];
    const data = [];

    // Filter workouts that include the selected exercise
    // We iterate in reverse to get oldest-to-newest for the chart
    const reversedWorkouts = [...allWorkouts].reverse();
    
    reversedWorkouts.forEach(workout => {
      const exercise = workout.exercises.find(ex => ex.name === selectedExercise);
      
      if (exercise) {
        labels.push(workout.date); // Use date as label
        let value = 0;

        switch (selectedMetric) {
          case 'maxWeight':
            // Calculate the max 1RM for this workout
            if (exercise.sets && exercise.sets.length > 0) {
              const all1RMs = exercise.sets.map(s => calculate1RM(s.weight, s.reps));
              value = Math.max(0, ...all1RMs);
            } else {
              value = 0;
            }
            break;
          case 'totalVolume':
            value = exercise.sets ? exercise.sets.reduce((total, set) => total + (set.weight * set.reps), 0) : 0;
            break;
          case 'maxReps':
            value = exercise.sets ? Math.max(0, ...exercise.sets.map(s => s.reps)) : 0;
            break;
          case 'duration':
            value = exercise.duration || 0;
            break;
          case 'distance':
            value = exercise.distance || 0;
            break;
        }
        data.push(value);
      }
    });

    if (data.length === 0) {
      // console.log("No data found for this metric.");
      return;
    }

    const ctx = document.getElementById('progress-chart').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${selectedExercise} - ${progressMetricSelect.options[progressMetricSelect.selectedIndex].text}`,
          data: data,
          backgroundColor: 'rgba(247, 187, 5, 0.2)',
          borderColor: 'rgba(247, 187, 5, 1)', // Amber color
          borderWidth: 2,
          tension: 0.1,
          fill: true,
          pointBackgroundColor: 'rgba(247, 187, 5, 1)',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#d1d5db' }, // Light gray ticks
            grid: { color: 'rgba(255, 255, 255, 0.1)' } // Faint grid lines
          },
          x: {
            ticks: { color: '#d1d5db' },
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#f3f4f6' // White legend text
            }
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#f3f4f6',
            bodyColor: '#d1d5db'
          }
        }
      }
    });
  }


  // New function to fill the form from a preset
  function populateWorkoutForm(exercises) {
    currentWorkoutList.innerHTML = ''; // Clear existing form

    exercises.forEach(ex => {
      // Clone the exercise template
      const templateContent = exerciseTemplate.content.cloneNode(true);
      const newItem = templateContent.querySelector('.exercise-item');
      newItem.id = `ex-${Date.now()}-${Math.random()}`;
      
      // Fill in the values
      newItem.querySelector('.exercise-name').value = ex.name;
      newItem.querySelector('.exercise-type-select').value = ex.type;

      const strengthInputs = newItem.querySelector('.strength-inputs');
      const cardioInputs = newItem.querySelector('.cardio-inputs');
      const setsList = newItem.querySelector('.sets-list');

      if (ex.type === 'strength') {
        strengthInputs.classList.remove('hidden');
        cardioInputs.classList.add('hidden');
        
        setsList.innerHTML = ''; // Clear any default sets from template
        
        ex.sets.forEach(set => {
          // Clone the set template
          const setTemplateContent = setItemTemplate.content.cloneNode(true);
          const newSetItem = setTemplateContent.querySelector('.set-item');

          // Populate and append the set
          newSetItem.querySelector('.set-weight').value = set.weight;
          newSetItem.querySelector('.set-reps').value = set.reps;
          setsList.appendChild(newSetItem);
        });

      } else {
        strengthInputs.classList.add('hidden');
        cardioInputs.classList.remove('hidden');
        newItem.querySelector('.cardio-duration').value = ex.duration;
        newItem.querySelector('.cardio-distance').value = ex.distance;
      }
      
      // Append the populated exercise item
      currentWorkoutList.appendChild(newItem);
    });
  }

}); // <-- End of DOMContentLoaded

