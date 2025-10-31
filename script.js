// Set up global constants for Firebase/Firestore paths
const USERNAME_DOMAIN = "utrack.app";
const WORKOUTS_COLLECTION = "utrack_workouts";
const TEMPLATES_COLLECTION = "utrack_templates";

// --- Firebase Utilities and Configuration ---

// This configuration is MANDATORY. Update with your own project details.
const firebaseConfig = {
    apiKey: "AIzaSyC-ri85nqnJGvrrj775WuejX-QwPAY_Gy8",
    authDomain: "fitness-tracker-995c6.firebaseapp.com",
    projectId: "fitness-tracker-995c6",
    storageBucket: "fitness-tracker-995c6.firebasestorage.app",
    messagingSenderId: "130310968795",
    appId: "1:130310968795:web:34cff6a756705cb8da03fe",
    measurementId: "G-VWVW12CGLV"
};

let app, db, auth;
let userId = null;
let workoutCollectionRef = null;
let templateCollectionRef = null;
let chartInstance = null;
let allWorkouts = [];
let workoutToDelete = null;
let isFirstHistoryLoad = true;
let isFirstTemplateLoad = true;
let firebaseAuth, firestore; // Modules imported from the HTML file

// --- DOM Element References ---
const refs = {};

// Helper to safely get DOM elements
function getRef(id) {
    if (!refs[id]) {
        refs[id] = document.getElementById(id);
    }
    return refs[id];
}

// --- Utility Functions ---

/**
 * Converts a username into an internal email address for Firebase Auth.
 * @param {string} username 
 * @returns {string} The converted email string.
 */
function usernameToEmail(username) {
    return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@${USERNAME_DOMAIN}`;
}

function showMessage(message) {
    getRef('message-text').textContent = message;
    getRef('message-modal').classList.remove('hidden');
}

function closeMessageModal() {
    getRef('message-modal').classList.add('hidden');
}

function closePresetModal() {
    getRef('save-preset-modal').classList.add('hidden');
    getRef('preset-name-input').value = '';
}

function cancelDelete() {
    getRef('delete-confirm-modal').classList.add('hidden');
    workoutToDelete = null;
}

function showView(view) {
    const views = ['log', 'history', 'templates'];
    const tabs = ['tab-log', 'tab-history', 'tab-templates'];
    
    views.forEach(v => getRef(`${v}-view`).classList.add('hidden'));
    tabs.forEach(t => {
        getRef(t).classList.remove('border-b-2', 'border-amber-500', 'text-amber-500');
        getRef(t).classList.add('text-gray-400');
    });

    getRef(`${view}-view`).classList.remove('hidden');
    const tabEl = getRef(`tab-${view}`);
    tabEl.classList.add('border-b-2', 'border-amber-500', 'text-amber-500');
    tabEl.classList.remove('text-gray-400');
}

// --- Authentication Logic ---

let isSigningUp = false;

function updateAuthView() {
    const authTitle = getRef('auth-title');
    const authSubmitBtn = getRef('auth-submit-btn');
    const authToggleText = getRef('auth-toggle-text');
    const authToggleLink = getRef('auth-toggle-link');
    const authUsernameInput = getRef('auth-username');
    const authError = getRef('auth-error');

    if (isSigningUp) {
        authTitle.textContent = 'Create Account (Sign Up)';
        authSubmitBtn.textContent = 'Sign Up';
        authToggleText.textContent = 'Already have an account?';
        authToggleLink.textContent = 'Sign In';
        authUsernameInput.placeholder = 'Choose a unique username';
    } else {
        authTitle.textContent = 'Welcome Back (Sign In)';
        authSubmitBtn.textContent = 'Sign In';
        authToggleText.textContent = 'Need an account?';
        authToggleLink.textContent = 'Sign Up';
        authUsernameInput.placeholder = 'Enter your username';
    }
    authError.textContent = '';
}

async function handleAuthSubmit() {
    const username = getRef('auth-username').value.trim();
    const password = getRef('auth-password').value;
    const authError = getRef('auth-error');
    const authSubmitBtn = getRef('auth-submit-btn');
    authError.textContent = '';

    if (!username || !password) {
        authError.textContent = 'Username and password are required.';
        return;
    }
    if (username.length < 3) {
        authError.textContent = 'Username must be at least 3 characters.';
        return;
    }

    const email = usernameToEmail(username);

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = isSigningUp ? 'Signing Up...' : 'Signing In...';

    try {
        let userCredential;
        if (isSigningUp) {
            userCredential = await firebaseAuth.createUserWithEmailAndPassword(auth, email, password);
            // After creation, set the user's display name to the actual username
            await firebaseAuth.updateProfile(userCredential.user, { displayName: username });
            showMessage(`Success! Account created for user: ${username}.`);
        } else {
            userCredential = await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
            showMessage(`Welcome back, ${userCredential.user.displayName || username}!`);
        }
        
    } catch (error) {
        console.error("Auth error:", error);
        if (error.code === 'auth/weak-password') {
            authError.textContent = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/email-already-in-use') {
            authError.textContent = 'Username already in use. Please choose another or try signing in.';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            authError.textContent = 'Invalid username or password.';
        } else {
            authError.textContent = `Authentication Error. Please try again.`;
        }
    } finally {
        authSubmitBtn.disabled = false;
        updateAuthView();
    }
}

async function handleSignOut() {
    try {
        await firebaseAuth.signOut(auth);
        showMessage("Signed out successfully.");
    } catch (error) {
        console.error("Sign out error:", error);
        showMessage("Error signing out.");
    }
}

/**
 * Initializes Firebase, sets up global listeners, and binds events.
 * This is called from the <script type="module"> block in index.html
 */
function setupApp(authModules, firestoreModules) {
    firebaseAuth = authModules;
    firestore = firestoreModules;

    try {
        // 1. Initialize Firebase Core
        firestore.setLogLevel('Debug');
        app = firebaseAuth.initializeApp(firebaseConfig);
        db = firestore.getFirestore(app);
        auth = firebaseAuth.getAuth(app);
        console.log("Firebase initialized.");

        // 2. Attach Auth Listener
        firebaseAuth.onAuthStateChanged(auth, (user) => {
            const mainContent = getRef('main-content');
            const authModal = getRef('auth-modal');
            const userIdDisplay = getRef('user-id-display');
            const signOutBtn = getRef('sign-out-btn');
            
            if (user) {
                // User is successfully signed in
                userId = user.uid;
                // Use the user's displayName (username) if available, otherwise fallback to UID prefix
                userIdDisplay.textContent = user.displayName || user.uid.substring(0, 8) + '...';
                authModal.classList.add('hidden');
                mainContent.classList.remove('hidden');
                signOutBtn.classList.remove('hidden');
                
                // Define the user-specific collection paths
                // Using root collections as per previous pattern
                workoutCollectionRef = firestore.collection(db, WORKOUTS_COLLECTION);
                templateCollectionRef = firestore.collection(db, TEMPLATES_COLLECTION);
                
                // Load data now that we are authenticated
                loadWorkoutHistory();
                loadWorkoutTemplates();

            } else {
                // User is signed out or not logged in
                userId = null;
                userIdDisplay.textContent = 'Signed Out';
                mainContent.classList.add('hidden');
                authModal.classList.remove('hidden');
                signOutBtn.classList.add('hidden');
                isFirstHistoryLoad = true;
                isFirstTemplateLoad = true;
                updateAuthView(); // Initialize auth view to Sign In
            }
        });

    } catch (e) {
        console.error("Error initializing Firebase/App:", e);
        getRef('app-container').innerHTML = `<p class="text-red-400 p-4 bg-red-900 rounded-lg">Error initializing application. Check Firebase Config and Console.</p>`;
        return;
    }

    // 3. Attach Event Listeners
    document.addEventListener('DOMContentLoaded', bindEventListeners);
    try {
    // ... app and db initialization here ...
    auth = getAuth(app);
    console.log("Firebase Initialized Successfully");
  } catch (e) {
    console.error("Error initializing Firebase: ", e);
  }
}

// Binds all DOM-related events
function bindEventListeners() {
    // Auth Modal Events
    getRef('auth-toggle-link').addEventListener('click', (e) => {
        e.preventDefault();
        isSigningUp = !isSigningUp;
        updateAuthView();
    });
    getRef('auth-submit-btn').addEventListener('click', handleAuthSubmit);
    getRef('sign-out-btn').addEventListener('click', handleSignOut);

    // Tab Events
    getRef('tab-log').addEventListener('click', () => showView('log'));
    getRef('tab-history').addEventListener('click', () => showView('history'));
    getRef('tab-templates').addEventListener('click', () => showView('templates'));

    // Modal Events
    getRef('close-message-btn').addEventListener('click', closeMessageModal);
    getRef('close-preset-modal-btn').addEventListener('click', closePresetModal);
    getRef('cancel-delete-btn').addEventListener('click', cancelDelete);
    getRef('confirm-delete-btn').addEventListener('click', handleConfirmDelete);

    // Log Workout Events
    getRef('workout-date').valueAsDate = new Date();
    getRef('add-exercise-btn').addEventListener('click', addExercise);
    getRef('current-workout-list').addEventListener('click', handleSetOrExerciseRemoval);
    getRef('current-workout-list').addEventListener('change', handleExerciseTypeChange);
    getRef('save-workout-btn').addEventListener('click', handleSaveWorkout);
    getRef('save-preset-btn').addEventListener('click', handleSavePresetRequest);
    getRef('confirm-save-preset-btn').addEventListener('click', handleConfirmSavePreset);
    getRef('history-list-container').addEventListener('click', handleHistoryDeleteRequest);
    getRef('load-preset-select').addEventListener('change', handleLoadPresetSelect);
    getRef('templates-list-container').addEventListener('click', handleTemplateActions);
    
    // Initial view set
    showView('log');
}


// --- Log Workout Functions ---

function addExercise() {
    const templateContent = getRef('exercise-template').content.cloneNode(true);
    const newExercise = templateContent.querySelector('.exercise-item');
    getRef('current-workout-list').appendChild(newExercise);
    addSet(newExercise.querySelector('.sets-list'));
}

function addSet(setsListContainer) {
    const templateContent = getRef('set-item-template').content.cloneNode(true);
    setsListContainer.appendChild(templateContent);
}

function handleSetOrExerciseRemoval(e) {
    if (e.target.classList.contains('add-set-btn')) {
        e.preventDefault();
        addSet(e.target.previousElementSibling);
    }
    if (e.target.closest('.remove-set-btn')) {
        e.preventDefault();
        e.target.closest('.set-item').remove();
    }
    if (e.target.closest('.remove-exercise-btn')) {
        e.preventDefault();
        e.target.closest('.exercise-item').remove();
    }
}

function handleExerciseTypeChange(e) {
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
}

function getCurrentExercisesFromForm() {
    const exercises = [];
    const exerciseItems = getRef('current-workout-list').querySelectorAll('.exercise-item');
    let valid = true;

    if (exerciseItems.length === 0) {
        return { valid: false, exercises: [], message: "Please add at least one exercise." };
    }

    exerciseItems.forEach(item => {
        const name = item.querySelector('.exercise-name').value.trim();
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

function populateWorkoutForm(exercises) {
    const list = getRef('current-workout-list');
    list.innerHTML = '';
    
    exercises.forEach(ex => {
        const templateContent = getRef('exercise-template').content.cloneNode(true);
        const newExercise = templateContent.querySelector('.exercise-item');
        
        newExercise.querySelector('.exercise-name').value = ex.name;
        newExercise.querySelector('.exercise-type-select').value = ex.type;

        const strengthInputs = newExercise.querySelector('.strength-inputs');
        const cardioInputs = newExercise.querySelector('.cardio-inputs');
        
        if (ex.type === 'strength') {
            strengthInputs.classList.remove('hidden');
            cardioInputs.classList.add('hidden');
            const setsList = newExercise.querySelector('.sets-list');
            
            ex.sets.forEach(set => {
                const setTemplateContent = getRef('set-item-template').content.cloneNode(true);
                const setItem = setTemplateContent.querySelector('.set-item');
                setItem.querySelector('.set-weight').value = set.weight;
                setItem.querySelector('.set-reps').value = set.reps;
                setsList.appendChild(setItem);
            });
            // Add a default set if no sets were loaded (shouldn't happen with saved data)
            if (ex.sets.length === 0) addSet(setsList);
            
        } else { // Cardio
            strengthInputs.classList.add('hidden');
            cardioInputs.classList.remove('hidden');
            newExercise.querySelector('.cardio-duration').value = ex.duration;
            newExercise.querySelector('.cardio-distance').value = ex.distance;
        }
        
        list.appendChild(newExercise);
    });
}

// --- Firestore Save/Load Handlers ---

async function handleSaveWorkout() {
    if (!workoutCollectionRef || !userId) {
        showMessage("Error: Not logged in or database not ready.");
        return;
    }

    const workoutDate = getRef('workout-date').value; 
    if (!workoutDate) {
        showMessage("Please select a date.");
        return;
    }

    const { valid, exercises, message } = getCurrentExercisesFromForm();

    if (!valid) {
        showMessage(message);
        return;
    }

    try {
        const saveWorkoutBtn = getRef('save-workout-btn');
        saveWorkoutBtn.disabled = true;
        saveWorkoutBtn.textContent = 'Saving...';
        
        await firestore.addDoc(workoutCollectionRef, {
            ownerId: userId, 
            date: workoutDate,
            exercises: exercises,
            createdAt: firestore.serverTimestamp() 
        });

        showMessage("Workout saved successfully!");
        getRef('current-workout-list').innerHTML = ''; 
        getRef('workout-date').valueAsDate = new Date(); 
    
    } catch (error) {
        console.error("Error saving workout: ", error);
        showMessage("Error: Could not save workout. Check Firestore rules.");
    } finally {
        getRef('save-workout-btn').disabled = false;
        getRef('save-workout-btn').textContent = 'Save Workout';
    }
}

function handleSavePresetRequest() {
    const { valid, exercises } = getCurrentExercisesFromForm();
    
    if (!valid || exercises.length === 0) {
        showMessage("Please add at least one exercise with a name to save a preset.");
        return;
    }
    
    getRef('preset-name-input').value = '';
    getRef('save-preset-modal').classList.remove('hidden');
    getRef('preset-name-input').focus();
}

async function handleConfirmSavePreset() {
    const templateName = getRef('preset-name-input').value.trim();
    if (!templateName) {
        showMessage("Please enter a name for the preset.");
        return;
    }

    if (!templateCollectionRef || !userId) {
        showMessage("Error: Not logged in or database not ready.");
        return;
    }
    
    const { valid, exercises } = getCurrentExercisesFromForm();

    if (!valid) {
        showMessage("Cannot save preset, form is invalid.");
        return;
    }

    try {
        const confirmSavePresetBtn = getRef('confirm-save-preset-btn');
        confirmSavePresetBtn.disabled = true;
        confirmSavePresetBtn.textContent = 'Saving...';
        
        await firestore.addDoc(templateCollectionRef, {
            ownerId: userId, 
            templateName: templateName,
            exercises: exercises,
            createdAt: firestore.serverTimestamp()
        });

        showMessage("Preset saved successfully!");
        closePresetModal();

    } catch (error) {
        console.error("Error saving preset: ", error);
        showMessage("Error: Could not save preset.");
    } finally {
        getRef('confirm-save-preset-btn').disabled = false;
        getRef('confirm-save-preset-btn').textContent = 'Confirm Save';
    }
}

function handleLoadPresetSelect(e) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    if (!selectedOption.value) return;

    // Use a try/catch in case the JSON parsing fails
    try {
        const exercises = JSON.parse(selectedOption.dataset.exercises.replace(/&apos;/g, "'"));
        populateWorkoutForm(exercises);
    } catch(err) {
        console.error("Failed to parse preset exercises:", err);
        showMessage("Error loading preset data. Please try again.");
    }
    
    // Reset the select box
    e.target.value = '';
}

function handleTemplateActions(e) {
    const loadBtn = e.target.closest('.load-preset-from-view-btn');
    const deleteBtn = e.target.closest('.delete-preset-btn');

    if (loadBtn) {
        // Find the parent template item to get data
        const templateItem = e.target.closest('.template-item');
        if (!templateItem) return;
        
        try {
            const exercises = JSON.parse(templateItem.dataset.exercises.replace(/&apos;/g, "'"));
            populateWorkoutForm(exercises);
            showView('log'); 
        } catch(err) {
            console.error("Failed to parse preset exercises:", err);
            showMessage("Error loading preset data. Please try again.");
        }
        
    } else if (deleteBtn) {
        const templateId = deleteBtn.dataset.id;
        if (templateId) {
            deleteTemplate(templateId);
        }
    }
}

async function deleteTemplate(templateId) {
    try {
        const docRef = firestore.doc(db, TEMPLATES_COLLECTION, templateId);
        await firestore.deleteDoc(docRef);
        showMessage("Template deleted.");
    } catch (error) {
        console.error("Error deleting template: ", error);
        showMessage("Error: Could not delete template.");
    }
}

function handleHistoryDeleteRequest(e) {
    const deleteBtn = e.target.closest('.delete-workout-btn');
    if (deleteBtn) {
        workoutToDelete = deleteBtn.dataset.id;
        const workoutDate = deleteBtn.dataset.date;
        getRef('delete-confirm-text').textContent = `Are you sure you want to delete the workout from ${workoutDate}? This action cannot be undone.`;
        getRef('delete-confirm-modal').classList.remove('hidden');
    }
}

async function handleConfirmDelete() {
    if (!workoutToDelete) return;

    try {
        const confirmDeleteBtn = getRef('confirm-delete-btn');
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';
        
        const docRef = firestore.doc(db, WORKOUTS_COLLECTION, workoutToDelete);
        await firestore.deleteDoc(docRef);
        
        showMessage("Workout deleted successfully.");

    } catch (error) {
        console.error("Error deleting workout: ", error);
        showMessage("Error: Could not delete workout.");
    } finally {
        getRef('delete-confirm-modal').classList.add('hidden');
        workoutToDelete = null;
        getRef('confirm-delete-btn').disabled = false;
        getRef('confirm-delete-btn').textContent = 'Confirm Delete';
    }
}

// --- Data Listeners (onSnapshot) ---

function loadWorkoutHistory() {
    if (!workoutCollectionRef || !userId) return;

    const q = firestore.query(workoutCollectionRef, firestore.where("ownerId", "==", userId));
    isFirstHistoryLoad = true;
    getRef('history-list-container').innerHTML = '<p class="text-gray-400">Loading workout history...</p>';

    firestore.onSnapshot(q, (snapshot) => {
        allWorkouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allWorkouts.sort((a, b) => {
            if (a.date > b.date) return -1;
            if (a.date < b.date) return 1;
            const aTime = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : 0) : 0;
            const bTime = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : 0) : 0;
            return bTime - aTime;
        });
        
        if (snapshot.empty) {
            getRef('history-list-container').innerHTML = '<p class="text-gray-400">No workouts saved yet. Go log one!</p>';
            return;
        }

        // Only redraw completely on first load
        if (isFirstHistoryLoad) {
            isFirstHistoryLoad = false;
            let html = allWorkouts.map(createHistoryItemHTML).join('');
            getRef('history-list-container').innerHTML = html;
        } else {
            // Handle incremental changes
            snapshot.docChanges().forEach((change) => {
                const workout = { id: change.doc.id, ...change.doc.data() };
                const workoutId = `workout-${workout.id}`;

                if (change.type === 'added' || change.type === 'modified') {
                    const newWorkoutHtml = createHistoryItemHTML(workout);
                    const existingEl = document.getElementById(workoutId);

                    if (existingEl) {
                        existingEl.outerHTML = newWorkoutHtml;
                    } else if (change.type === 'added') {
                         // Simple prepend for new items on subsequent loads
                        getRef('history-list-container').insertAdjacentHTML('afterbegin', newWorkoutHtml);
                    }
                    
                } else if (change.type === 'removed') {
                    const existingEl = document.getElementById(workoutId);
                    if (existingEl) existingEl.remove();
                }
            });

            if (getRef('history-list-container').children.length === 0) {
                getRef('history-list-container').innerHTML = '<p class="text-gray-400">No workouts saved yet. Go log one!</p>';
            }
        }
    }, (error) => {
        console.error("Error loading history: ", error);
        getRef('history-list-container').innerHTML = `<p class="text-red-400">Error loading workout history. Did you set the <strong class="font-bold">Firestore Security Rules</strong>?</p>`;
        isFirstHistoryLoad = true;
    });
}

function createHistoryItemHTML(workout) {
    const d = new Date(workout.date + 'T00:00:00');
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

function loadWorkoutTemplates() {
    if (!templateCollectionRef || !userId) return;
    
    isFirstTemplateLoad = true;
    
    const q = firestore.query(templateCollectionRef, firestore.where("ownerId", "==", userId));

    firestore.onSnapshot(q, (snapshot) => {
        let templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        templates.sort((a, b) => a.templateName.localeCompare(b.templateName));
        
        renderTemplateDropdown(templates);

        if (snapshot.empty) {
            getRef('templates-list-container').innerHTML = '<p class="text-gray-400">No presets saved yet.</p>';
            return;
        }

        if (isFirstTemplateLoad) {
            isFirstTemplateLoad = false;
            let html = templates.map(createTemplateItemHTML).join('');
            getRef('templates-list-container').innerHTML = html;
        } else {
            // Re-render completely for simplicity on updates, as templates are not high-frequency
            let html = templates.map(createTemplateItemHTML).join('');
            getRef('templates-list-container').innerHTML = html;
        }

    }, (error) => {
        console.error("Error loading templates: ", error);
        getRef('templates-list-container').innerHTML = `<p class="text-red-400">Error loading templates.</p>`;
        isFirstTemplateLoad = true; 
    });
}

function renderTemplateDropdown(templates) {
    let html = '<option value="">-- Load from Preset --</option>';
    templates.forEach(template => {
        const exercisesJson = JSON.stringify(template.exercises).replace(/'/g, '&apos;');
        html += `<option value="${template.id}" data-exercises='${exercisesJson}'>
            ${template.templateName}
        </option>`;
    });
    getRef('load-preset-select').innerHTML = html;
}

function createTemplateItemHTML(template) {
    const exercisesJson = JSON.stringify(template.exercises).replace(/'/g, '&apos;');
        
    let html = `
        <div id="template-${template.id}" class="template-item bg-gray-800 p-4 rounded-xl shadow-md" data-name="${template.templateName}" data-exercises='${exercisesJson}'>
            <div class="flex justify-between items-start mb-3">
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
        <button class="load-preset-from-view-btn w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 px-4 rounded-lg">
            Load Preset
        </button>
        </div>
    `;
    return html;
}


// --- Final Setup ---

// Call the function defined in index.html to start the application setup
window.initializeTracker(setupApp);


