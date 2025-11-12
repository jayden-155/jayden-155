import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, addDoc, onSnapshot, collection, query, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, X, Zap, Dumbbell, History, ListChecks, Home, Target, ChevronRight, User, Key, Mail } from 'lucide-react';

// --- Firebase and Utility Setup ---

// Replace these placeholders with your actual Firebase config details when deploying!
const firebaseConfig = {
  apiKey: "AIzaSyC-ri85nqnJGvrrj775WuejX-QwPAY_Gy8",
  authDomain: "fitness-tracker-995c6.firebaseapp.com",
  projectId: "fitness-tracker-995c6",
  storageBucket: "fitness-tracker-995c6.firebasestorage.app",
  messagingSenderId: "130310968795",
  appId: "1:130310968795:web:34cff6a756705cb8da03fe",
  measurementId: "G-VWVW12CGLV"
};
const appId = firebaseConfig.appId || 'default-app-id'; // Use Firebase App ID as the collection identifier

// Initialize Firebase (Only runs once)
let app, db, auth;
if (firebaseConfig.projectId && typeof window !== 'undefined') {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

// Custom Toast component
const Toast = ({ message, type, onClose }) => (
  <div className={`fixed bottom-5 right-5 p-4 rounded-xl shadow-xl text-white max-w-xs w-full z-[9999] ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
    <div className="flex justify-between items-center">
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 font-bold">
        <X size={20} />
      </button>
    </div>
  </div>
);

// --- Static Data (Updated for Multi-Muscle Targeting) ---
const ALL_MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves',
    'Biceps', 'Triceps', 'Forearms', 'Core', 'Other'
];

const BASE_EXERCISES = [
    // Chest Primary
    { name: 'Barbell Bench Press', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Shoulders'] },
    { name: 'Dumbbell Bench Press', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Shoulders'] },
    { name: 'Incline Dumbbell Press', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
    { name: 'Cable Crossover', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders'] },
    { name: 'Push-ups', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Shoulders', 'Core'] },

    // Back Primary
    { name: 'Deadlift (Conventional/Sumo)', primaryMuscle: 'Back', secondaryMuscles: ['Hamstrings', 'Glutes', 'Forearms', 'Core'] },
    { name: 'Barbell Row', primaryMuscle: 'Back', secondaryMuscles: ['Biceps', 'Forearms'] },
    { name: 'Pull-ups', primaryMuscle: 'Back', secondaryMuscles: ['Biceps', 'Forearms'] },
    { name: 'Lat Pulldown', primaryMuscle: 'Back', secondaryMuscles: ['Biceps', 'Forearms'] },
    { name: 'Seated Cable Row', primaryMuscle: 'Back', secondaryMuscles: ['Biceps', 'Forearms'] },

    // Shoulder Primary
    { name: 'Overhead Press (Barbell/Dumbbell)', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps', 'Core'] },
    { name: 'Lateral Raise', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Front Raise', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Face Pull', primaryMuscle: 'Shoulders', secondaryMuscles: ['Back'] },
    { name: 'Shrugs', primaryMuscle: 'Shoulders', secondaryMuscles: ['Back'] },

    // Quadriceps Primary
    { name: 'Squat (Barbell/Dumbbell)', primaryMuscle: 'Quadriceps', secondaryMuscles: ['Glutes', 'Hamstrings', 'Core'] },
    { name: 'Leg Press', primaryMuscle: 'Quadriceps', secondaryMuscles: ['Glutes', 'Hamstrings'] },
    { name: 'Leg Extension', primaryMuscle: 'Quadriceps', secondaryMuscles: [] },
    
    // Hamstrings Primary
    { name: 'Romanian Deadlift', primaryMuscle: 'Hamstrings', secondaryMuscles: ['Glutes', 'Back', 'Forearms'] },
    { name: 'Hamstring Curl (Lying/Seated)', primaryMuscle: 'Hamstrings', secondaryMuscles: [] },
    
    // Glutes Primary
    { name: 'Hip Thrust', primaryMuscle: 'Glutes', secondaryMuscles: ['Hamstrings'] },
    { name: 'Bulgarian Split Squat', primaryMuscle: 'Glutes', secondaryMuscles: ['Quadriceps', 'Hamstrings', 'Core'] },
    
    // Calves Primary
    { name: 'Standing Calf Raise', primaryMuscle: 'Calves', secondaryMuscles: [] },
    { name: 'Seated Calf Raise', primaryMuscle: 'Calves', secondaryMuscles: [] },
    
    // Biceps Primary
    { name: 'Barbell Curl', primaryMuscle: 'Biceps', secondaryMuscles: ['Forearms'] },
    { name: 'Dumbbell Curl', primaryMuscle: 'Biceps', secondaryMuscles: ['Forearms'] },
    { name: 'Hammer Curl', primaryMuscle: 'Biceps', secondaryMuscles: ['Forearms'] },

    // Triceps Primary
    { name: 'Triceps Pushdown', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Skullcrusher', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Dips', primaryMuscle: 'Triceps', secondaryMuscles: ['Chest', 'Shoulders'] },

    // Forearms Primary
    { name: 'Wrist Curls', primaryMuscle: 'Forearms', secondaryMuscles: [] },
    { name: 'Farmer\'s Walk', primaryMuscle: 'Forearms', secondaryMuscles: ['Back', 'Core'] },

    // Core Primary
    { name: 'Plank', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Crunches', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Leg Raises', primaryMuscle: 'Core', secondaryMuscles: [] },
];

// --- Authentication Screen (Internal Component) ---
const AuthScreen = ({ showToast, setIsLoggedIn }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Helper to map username to a safe, unique email for Firebase Auth
    const usernameToEmail = (user) => `${user.toLowerCase().trim()}@${appId}-fitness.com`;

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username.trim() || !password.trim()) {
            setError("Username and password are required.");
            setLoading(false);
            return;
        }

        const email = usernameToEmail(username);

        try {
            if (isRegistering) {
                // 1. Check if username already exists in Firestore (optional but helpful)
                // This check is complex, so we rely on Firebase's email-already-in-use error below for simplicity

                // 2. Register new user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;

                // 3. Create the username mapping document
                const userRef = doc(db, "artifacts", appId, "users", uid);
                await setDoc(userRef, { username: username.trim(), createdAt: new Date().toISOString() });
                
                showToast("Registration successful! Logging in...", 'success');
            } else {
                // 1. Sign in existing user
                await signInWithEmailAndPassword(auth, email, password);
                showToast("Logged in successfully!", 'success');
            }
            // onAuthStateChanged will handle setting the main App state (isLoggedIn)
        } catch (err) {
            console.error("Auth Error:", err.code, err.message);
            
            let displayError = "An unknown error occurred. Check your network or Firebase setup.";
            if (err.code === 'auth/email-already-in-use') {
                displayError = "That username is already taken. Try signing in.";
            } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
                displayError = "Invalid username or password.";
            } else if (err.code === 'auth/weak-password') {
                displayError = "Password should be at least 6 characters.";
            }
            
            setError(displayError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
            <div className="w-full max-w-md bg-gray-800 p-8 sm:p-10 rounded-xl shadow-2xl space-y-6">
                <div className="text-center">
                    <Zap size={48} className="text-blue-500 mx-auto" />
                    <h2 className="mt-4 text-3xl font-bold text-white">
                        {isRegistering ? 'Create Account' : 'Sign In'}
                    </h2>
                    <p className="text-gray-400">Track your progress like a pro.</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {error && (
                        <div className="bg-red-900 text-red-300 p-3 rounded-lg text-sm font-medium border border-red-700">
                            {error}
                        </div>
                    )}

                    <div className="relative">
                        <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="w-full p-3 pl-10 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                            required
                        />
                    </div>
                    
                    <div className="relative">
                        <Key size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full p-3 pl-10 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition duration-300 shadow-lg disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Sign In')}
                    </button>
                </form>

                <button
                    onClick={() => {
                        setIsRegistering(prev => !prev);
                        setError('');
                    }}
                    className="w-full text-sm text-blue-400 hover:text-blue-300 transition mt-4"
                >
                    {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
                </button>
            </div>
        </div>
    );
};

// --- Navigation Component (Internal Component) ---

const BottomNav = ({ currentView, setView, setSelectedExercise }) => {
  const navItems = [
    { name: 'Home', icon: Home, view: 'dashboard' },
    { name: 'Routines', icon: Dumbbell, view: 'routines' },
    { name: 'History', icon: History, view: 'history' },
    { name: 'Exercises', icon: ListChecks, view: 'exercises' },
  ];

  const handleNavClick = (view) => {
    if (view !== 'exercises') {
        setSelectedExercise(null);
    }
    setView(view);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-2xl z-40 sm:hidden">
      <div className="flex justify-around h-16">
        {navItems.map(item => {
          const isActive = currentView === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={`flex flex-col items-center justify-center w-1/4 pt-2 transition-colors ${
                isActive ? 'text-blue-500' : 'text-gray-400 hover:text-blue-400'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs font-medium mt-1">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Add Exercise Form (Internal Component) ---

const AddExerciseForm = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [primaryMuscle, setPrimaryMuscle] = useState(ALL_MUSCLE_GROUPS[0]);
    const [secondaryMuscles, setSecondaryMuscles] = useState([]);
    const [error, setError] = useState('');

    const handleSecondaryChange = (e) => {
        const options = Array.from(e.target.selectedOptions, (item) => item.value);
        setSecondaryMuscles(options.filter(muscle => muscle !== primaryMuscle));
    };

    const handlePrimaryChange = (e) => {
        const newPrimary = e.target.value;
        setPrimaryMuscle(newPrimary);
        setSecondaryMuscles(prev => prev.filter(muscle => muscle !== newPrimary));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError("Exercise name is required.");
            return;
        }

        if (primaryMuscle === 'Other' && secondaryMuscles.length === 0) {
            setError("If the primary muscle is 'Other', please select at least one secondary muscle.");
            return;
        }

        onSave({ 
            name: name.trim(), 
            primaryMuscle: primaryMuscle,
            secondaryMuscles: secondaryMuscles
        });
    };
    
    const primaryMuscleOptions = ALL_MUSCLE_GROUPS.filter(g => g !== 'Other').sort().concat(['Other']);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h3 className="text-2xl font-bold text-white">Add Custom Exercise</h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-900 text-red-300 p-3 rounded-lg text-sm font-medium border border-red-700">{error}</div>
                    )}
                    
                    <div className="space-y-2">
                        <label htmlFor="exerciseName" className="block text-sm font-medium text-gray-300">Name</label>
                        <input
                            id="exerciseName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Single Arm Dumbbell Row"
                            required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label htmlFor="primaryMuscle" className="block text-sm font-medium text-gray-300">Primary Muscle (Required)</label>
                        <select
                            id="primaryMuscle"
                            value={primaryMuscle}
                            onChange={handlePrimaryChange}
                            className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            {primaryMuscleOptions.map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="secondaryMuscles" className="block text-sm font-medium text-gray-300">Secondary Muscles (Optional, hold Ctrl/Cmd to select multiple)</label>
                        <select
                            id="secondaryMuscles"
                            multiple
                            value={secondaryMuscles}
                            onChange={handleSecondaryChange}
                            className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 h-32"
                        >
                            {ALL_MUSCLE_GROUPS.filter(g => g !== primaryMuscle).map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md"
                        >
                            Add Exercise
                        </button>
                    </div>
                </form> 
            </div>
        </div>
    );
};


// --- Exercise Progress Components (Internal Component) ---

const StatsCard = ({ title, value, unit, icon: Icon }) => (
    <div className="p-4 bg-gray-800 rounded-xl shadow border border-gray-700 flex items-center space-x-4">
        <div className="p-3 bg-red-800 rounded-full text-red-300">
            <Icon size={24} />
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {unit && <span className="text-xs text-gray-500">{unit}</span>}
        </div>
    </div>
);

const ExerciseDetail = ({ exerciseName, logs, onBack, exerciseMetadata }) => {
    const primaryMuscle = exerciseMetadata?.primaryMuscle || 'N/A';
    const secondaryMuscles = exerciseMetadata?.secondaryMuscles || [];
    
    const relevantLogs = logs.map(log => {
        const exerciseData = Array.isArray(log.exercises) ? log.exercises.find(ex => ex.name.trim() === exerciseName.trim()) : null;
        if (exerciseData) {
            return {
                ...log,
                exercise: exerciseData,
                date: new Date(log.timestamp).toLocaleDateString(),
            };
        }
        return null;
    }).filter(log => log !== null);
    
    let maxWeight = 0;
    let maxReps = 0;

    relevantLogs.forEach(log => {
        const weight = parseFloat(log.exercise.completedWeight) || 0;
        const reps = parseInt(log.exercise.reps) || parseInt(log.exercise.completedReps) || 0;
        
        if (weight > maxWeight) {
            maxWeight = weight;
        }
        if (reps > maxReps) {
            maxReps = reps;
        }
    });

    return (
        <div className="space-y-6 pb-20 sm:pb-0">
            <button
                onClick={onBack}
                className="mb-4 text-blue-500 hover:text-blue-400 flex items-center font-medium transition-colors"
            >
                <ArrowLeft size={18} className="mr-1" /> Back to List
            </button>
            <h2 className="text-3xl font-bold text-white border-b border-gray-700 pb-2">{exerciseName}</h2>
            
            <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-300">Primary Target:</p>
                <span className="text-sm text-white bg-blue-600 p-2 rounded-lg inline-block font-medium shadow-md">{primaryMuscle}</span>
                
                {secondaryMuscles.length > 0 && (
                    <div className="pt-2">
                        <p className="text-sm font-semibold text-gray-300">Secondary Targets:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {secondaryMuscles.map(muscle => (
                                <span key={muscle} className="text-xs text-gray-300 bg-gray-700 px-3 py-1 rounded-full font-medium">
                                    {muscle}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {relevantLogs.length === 0 ? (
                <div className="text-center p-8 bg-yellow-900 rounded-xl text-yellow-300 font-medium">
                    No history found for this exercise yet. Log a workout to start tracking progress!
                </div>
            ) : (
                <>
                    <h3 className="text-xl font-semibold text-white mt-8">Personal Records (PRs)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <StatsCard title="Max Weight" value={maxWeight} unit="kg/lbs" icon={Dumbbell} />
                        <StatsCard title="Max Reps" value={maxReps} unit="in a single set" icon={Target} />
                    </div>

                    <h3 className="text-xl font-semibold text-white mt-8">Recent History ({relevantLogs.length} entries)</h3>
                    <div className="w-full space-y-3">
                        {relevantLogs.slice(0, 5).map((log, index) => (
                            <div key={log.id} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-gray-300">{log.date}</span>
                                    <span className="text-blue-400">{log.routineName || 'Custom'}</span>
                                </div>
                                <div className="mt-1 text-sm text-gray-400">
                                    {log.exercise.completedSets} sets | Best: <span className="font-bold text-white">{log.exercise.completedWeight || '0'} kg/lbs</span> x <span className="font-bold text-white">{log.exercise.reps || log.exercise.completedReps || '0'} reps</span>
                                </div>
                            </div>
                        ))}
                        {relevantLogs.length > 5 && (
                            <p className="text-center text-sm text-gray-500 pt-2">... and {relevantLogs.length - 5} older logs.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const ExerciseScreen = ({ logs, customExercises, selectedExercise, setSelectedExercise, setIsAddFormOpen }) => {
    const masterExerciseList = {};
    const exerciseMetadataMap = new Map(); 

    const allExercises = [...BASE_EXERCISES, ...customExercises];

    allExercises.forEach(ex => {
        const group = ex.primaryMuscle || 'Other';
        const names = masterExerciseList[group] || [];
        
        if (!names.find(item => item.name === ex.name)) {
            names.push({ name: ex.name, primaryMuscle: ex.primaryMuscle, secondaryMuscles: ex.secondaryMuscles });
            masterExerciseList[group] = names;
        }
        
        exerciseMetadataMap.set(ex.name, { 
            primaryMuscle: ex.primaryMuscle, 
            secondaryMuscles: ex.secondaryMuscles 
        });
    });

    let exerciseMetadata = null;
    if (selectedExercise) {
        exerciseMetadata = exerciseMetadataMap.get(selectedExercise);
    }

    if (selectedExercise) {
        return (
            <ExerciseDetail 
                exerciseName={selectedExercise} 
                exerciseMetadata={exerciseMetadata}
                logs={logs} 
                onBack={() => setSelectedExercise(null)}
            />
        );
    }

    const sortedMuscleGroups = ALL_MUSCLE_GROUPS.filter(g => g !== 'Other').sort().concat(ALL_MUSCLE_GROUPS.includes('Other') ? ['Other'] : []);


    return (
        <div className="space-y-6 pb-20 sm:pb-0">
            <div className="flex justify-between items-center w-full">
                <h2 className="text-2xl font-semibold text-white">Exercise Database</h2>
                <button
                    onClick={() => setIsAddFormOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-transform duration-150 ease-in-out hover:scale-[1.02] flex items-center text-sm"
                >
                    <Plus size={16} className="inline mr-1" />
                    Add Custom
                </button>
            </div>
            
            <p className="text-gray-400 text-sm">Select an exercise to view its historical progress and personal records (PRs).</p>

            <div className="w-full space-y-8">
                {sortedMuscleGroups.map(group => {
                    const exercises = masterExerciseList[group] || [];
                    if (exercises.length === 0) return null;

                    return (
                        <div key={group}>
                            <h3 className="text-xl font-bold text-blue-500 border-b-2 border-blue-500 pb-1 mb-4">{group}</h3>
                            <div className="space-y-2">
                                {exercises.map(ex => (
                                    <button
                                        key={ex.name}
                                        onClick={() => setSelectedExercise(ex.name)}
                                        className="w-full p-3 bg-gray-800 rounded-lg shadow-sm border border-gray-700 flex justify-between items-center transition-all duration-200 hover:shadow-md hover:border-blue-500 text-left"
                                    >
                                        <div>
                                            <span className="font-medium text-white">{ex.name}</span>
                                            {ex.secondaryMuscles && ex.secondaryMuscles.length > 0 && (
                                                <span className="block text-xs text-gray-400 mt-0.5">
                                                    + {ex.secondaryMuscles.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronRight size={18} className="text-blue-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {Object.keys(masterExerciseList).length === 0 && (
                <p className="text-gray-400 italic p-6 border border-gray-700 rounded-xl bg-gray-800 shadow-sm text-center">
                    Start logging workouts or creating routines to build your exercise list.
                </p>
            )}
        </div>
    );
};


// --- Routine/Log Form Components (Internal Component) ---

const RoutineForm = ({ routineToEdit, onSave, onCancel }) => {
    const [routineName, setRoutineName] = useState(routineToEdit ? routineToEdit.name : '');
    const [exercises, setExercises] = useState(
      routineToEdit && routineToEdit.exercises ? 
        routineToEdit.exercises.map(ex => ({ ...ex, id: ex.id || crypto.randomUUID() })) 
        : [{ id: crypto.randomUUID(), name: '', sets: '', reps: '', weight: '' }]
    );
    const [error, setError] = useState('');

    useEffect(() => {
        setRoutineName(routineToEdit ? routineToEdit.name : '');
        setExercises(
            routineToEdit && routineToEdit.exercises ? 
                routineToEdit.exercises.map(ex => ({ ...ex, id: ex.id || crypto.randomUUID() })) 
                : [{ id: crypto.randomUUID(), name: '', sets: '', reps: '', weight: '' }]
        );
        setError('');
    }, [routineToEdit]);

    const handleExerciseChange = (id, field, value) => {
        setExercises(prev => prev.map(ex => 
            ex.id === id ? { ...ex, [field]: value } : ex
        ));
    };

    const handleAddExercise = () => {
        setExercises(prev => [...prev, { id: crypto.randomUUID(), name: '', sets: '', reps: '', weight: '' }]);
    };

    const handleRemoveExercise = (id) => {
        setExercises(prev => prev.filter(ex => ex.id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!routineName.trim()) {
            setError("Routine name is required.");
            return;
        }

        const validExercises = exercises.filter(ex => ex.name.trim());
        if (validExercises.length === 0) {
            setError("At least one exercise with a name is required.");
            return;
        }

        const exercisesToSave = validExercises.map(ex => ({
            name: ex.name.trim(),
            sets: ex.sets || '3', 
            reps: ex.reps || '10', 
            weight: ex.weight || '0' 
        }));

        const savedRoutine = {
            name: routineName.trim(),
            exercises: exercisesToSave, 
        };

        onSave(savedRoutine);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mt-8 mb-4 sm:my-8 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h3 className="text-2xl font-bold text-white">
                        {routineToEdit ? 'Edit Routine' : 'Create New Routine'}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="routineName" className="block text-sm font-medium text-gray-300">Routine Name</label>
                        <input
                            id="routineName"
                            type="text"
                            value={routineName}
                            onChange={(e) => setRoutineName(e.target.value)}
                            className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                            placeholder="e.g., Monday Push Day"
                            required
                        />
                    </div>

                    <h4 className="text-xl font-semibold mt-4 border-b border-gray-700 pb-2 text-white">Exercises</h4>
                    {error && (
                        <div className="bg-red-900 text-red-300 p-3 rounded-lg text-sm font-medium border border-red-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {exercises.map((exercise, index) => (
                            <div key={exercise.id} className="p-4 border border-gray-700 rounded-xl bg-gray-900 flex flex-col space-y-3 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <h5 className="font-medium text-blue-500">Exercise {index + 1}</h5>
                                    {exercises.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveExercise(exercise.id)}
                                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>
                                
                                <input
                                    type="text"
                                    value={exercise.name}
                                    onChange={(e) => handleExerciseChange(exercise.id, 'name', e.target.value)}
                                    className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm"
                                    placeholder="Exercise Name (e.g., Bench Press)"
                                    required={index === 0}
                                />
                                <div className="grid grid-cols-3 gap-3">
                                    <input
                                        type="number"
                                        value={exercise.sets}
                                        onChange={(e) => handleExerciseChange(exercise.id, 'sets', e.target.value)}
                                        className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm"
                                        placeholder="Sets"
                                    />
                                    <input
                                        type="number"
                                        value={exercise.reps}
                                        onChange={(e) => handleExerciseChange(exercise.id, 'reps', e.target.value)}
                                        className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm"
                                        placeholder="Reps"
                                    />
                                    <input
                                        type="number"
                                        value={exercise.weight}
                                        onChange={(e) => handleExerciseChange(exercise.id, 'weight', e.target.value)}
                                        className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm"
                                        placeholder="Weight (kg/lbs)"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                        <button
                            type="button"
                            onClick={handleAddExercise}
                            className="flex items-center text-blue-500 hover:text-blue-400 transition-colors text-sm font-medium border border-blue-800 bg-blue-900/30 py-2 px-3 rounded-lg"
                        >
                            <Plus size={16} className="mr-1" /> Add Exercise
                        </button>
                        <div className="space-x-4">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                            >
                                {routineToEdit ? 'Save Changes' : 'Create Routine'}
                            </button>
                        </div>
                    </div>
                </form> 
            </div>
        </div>
    );
};

const LogWorkoutForm = ({ routines, routineToStartId, onLog, onCancel, showToast }) => {
    const [selectedRoutine, setSelectedRoutine] = useState(null);
    const [workoutExercises, setWorkoutExercises] = useState([]);
    const [logRoutineName, setLogRoutineName] = useState('New Workout');
    const [error, setError] = useState('');

    useEffect(() => {
        let initialExercises = [];
        let name = 'New Workout';

        if (routineToStartId) {
            const routine = routines.find(r => r.id === routineToStartId);
            if (routine) {
                setSelectedRoutine(routine);
                name = routine.name;
                initialExercises = routine.exercises;
            }
        }
        
        setLogRoutineName(name);
        setWorkoutExercises(initialExercises.map(ex => ({
            ...ex,
            completedSets: ex.sets || '0', 
            completedReps: ex.reps || '0',
            completedWeight: ex.weight || '0',
        })));
        setError('');
    }, [routineToStartId, routines]);

    const handleLogChange = (index, field, value) => {
        const updatedExercises = [...workoutExercises];
        updatedExercises[index][field] = value;
        setWorkoutExercises(updatedExercises);
    };

    const handleLogSubmit = (e) => {
        e.preventDefault();
        setError('');

        const logData = {
            routineId: selectedRoutine ? selectedRoutine.id : null,
            routineName: logRoutineName.trim() || 'Custom Workout',
            exercises: workoutExercises.map(ex => ({
                name: ex.name.trim(),
                completedSets: parseInt(ex.completedSets) || 0,
                reps: parseInt(ex.completedReps) || 0, // Goal reps
                completedReps: parseInt(ex.completedReps) || 0, // Logged reps (using goal as default)
                weight: parseFloat(ex.completedWeight) || 0,
            })).filter(ex => ex.completedSets > 0 && ex.name.trim()), 

        };

        if (logData.exercises.length === 0) {
            showToast("You must complete at least one set for an exercise to log a workout.", 'error'); 
            return;
        }

        onLog(logData);
    };

    const handleAddExerciseToLog = () => {
        setWorkoutExercises(prev => [...prev, { 
            name: '', 
            sets: '3', 
            reps: '10', 
            weight: '0',
            completedSets: '0',
            completedReps: '0',
            completedWeight: '0',
        }]);
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mt-8 mb-4 sm:my-8 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h3 className="text-2xl font-bold text-white">
                        Log Workout: {logRoutineName}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleLogSubmit} className="p-6 overflow-y-auto space-y-6">
                    {workoutExercises.map((exercise, index) => (
                        <div key={index} className="p-4 border border-blue-700 rounded-xl bg-blue-900/30 space-y-3">
                            <input 
                                type="text"
                                value={exercise.name}
                                onChange={(e) => handleLogChange(index, 'name', e.target.value)}
                                className="font-bold text-blue-300 w-full bg-transparent border-b border-blue-700 pb-1 focus:border-blue-500 focus:outline-none"
                                placeholder="Exercise Name"
                                required
                            />
                            <div className="grid grid-cols-3 gap-3 text-center text-sm font-medium text-gray-400">
                                <div>Sets Logged</div>
                                <div>Reps</div>
                                <div>Weight (kg/lbs)</div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <input
                                    type="number"
                                    value={exercise.completedSets}
                                    onChange={(e) => handleLogChange(index, 'completedSets', e.target.value)}
                                    className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm focus:border-blue-500"
                                    placeholder={exercise.sets || '3'}
                                    min="0"
                                />
                                <input
                                    type="number"
                                    value={exercise.completedReps}
                                    onChange={(e) => handleLogChange(index, 'completedReps', e.target.value)}
                                    className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm"
                                    placeholder={exercise.reps || '10'}
                                />
                                <input
                                    type="number"
                                    value={exercise.completedWeight}
                                    onChange={(e) => handleLogChange(index, 'completedWeight', e.target.value)}
                                    className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm"
                                    placeholder={exercise.weight || '0'}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Goal: {exercise.sets} sets of {exercise.reps} reps @ {exercise.weight} kg/lbs
                            </p>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={handleAddExerciseToLog}
                        className="flex items-center text-blue-500 hover:text-blue-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg border border-blue-800 bg-blue-900/30"
                    >
                        <Plus size={16} className="mr-1" /> Add Custom Exercise to Log
                    </button>


                    <div className="flex justify-end space-x-4 pt-4 border-t border-gray-700">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md"
                        >
                            Finish & Log Workout
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Screen Components (Internal Component) ---

const DashboardScreen = ({ routines, onLog, setView, username }) => {
    const sortedRoutines = routines.slice(0, 3);
    const lastWorkoutDate = 'N/A'; 

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                <h2 className="text-3xl font-bold text-white">Welcome back, {username}!</h2>
                <button 
                    onClick={() => onLog()}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-xl shadow-lg transition-transform duration-150 ease-in-out hover:scale-105 flex items-center text-lg"
                >
                    <Zap size={20} className="mr-2" /> 
                    Start Empty
                </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-6 bg-blue-900/30 rounded-xl shadow-md border border-blue-700">
                    <History size={24} className="text-blue-500 mb-2" />
                    <p className="text-lg font-semibold text-gray-300">Last Workout</p>
                    <p className="text-xl font-bold text-blue-400">{lastWorkoutDate}</p>
                </div>
                <div className="p-6 bg-red-900/30 rounded-xl shadow-md border border-red-700">
                    <Target size={24} className="text-red-500 mb-2" />
                    <p className="text-lg font-semibold text-gray-300">Total PRs</p>
                    <p className="text-xl font-bold text-red-400">--</p>
                </div>
            </div>

            <h3 className="text-2xl font-semibold text-white pt-4 border-t border-gray-700">Quick Start Routines</h3>
            
            {routines.length > 0 ? (
                <div className="space-y-3">
                    {sortedRoutines.map(routine => (
                        <div key={routine.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl shadow-sm flex justify-between items-center hover:bg-gray-700 transition-colors">
                            <div>
                                <p className="font-semibold text-white">{routine.name}</p>
                                <p className="text-sm text-gray-400">{routine.exercises.length} exercises</p>
                            </div>
                            <button
                                onClick={() => onLog(routine.id)}
                                className="bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Start
                            </button>
                        </div>
                    ))}
                    {routines.length > 3 && (
                        <button 
                            onClick={() => setView('routines')} 
                            className="w-full text-center text-blue-500 font-medium pt-2 hover:text-blue-400"
                        >
                            View All Routines ({routines.length})
                        </button>
                    )}
                </div>
            ) : (
                <div className="text-center p-8 bg-gray-700 rounded-xl text-gray-300">
                    <Dumbbell size={32} className="mx-auto mb-3 text-gray-400" />
                    <p>No routines yet. Go to the Routines tab to create your first plan!</p>
                </div>
            )}
        </div>
    );
};

const RoutinesScreen = ({ routines, onLog, onEdit, onDelete, setView }) => {
    return (
        <div className="space-y-6 pb-20 sm:pb-0">
            <div className="flex justify-between items-center w-full">
                <h2 className="text-2xl font-semibold text-white">My Routines</h2>
                <button
                    onClick={() => onEdit(null)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-transform duration-150 ease-in-out hover:scale-[1.02] flex items-center text-sm"
                >
                    <Plus size={16} className="inline mr-1" />
                    New Routine
                </button>
            </div>
            
            {routines.length === 0 ? (
                <div className="text-center p-12 bg-gray-700 rounded-xl text-gray-300">
                    <Dumbbell size={40} className="mx-auto mb-3 text-gray-400" />
                    <p>No routines created yet. Click "New Routine" to get started!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {routines.map(routine => (
                        <div key={routine.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl shadow-md">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-blue-400">{routine.name}</h3>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => onLog(routine.id)}
                                        className="bg-green-600 text-white p-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                                        title="Start Workout"
                                    >
                                        <Zap size={16} />
                                    </button>
                                    <button
                                        onClick={() => onEdit(routine.id)}
                                        className="bg-yellow-600 text-white p-2 rounded-lg text-sm hover:bg-yellow-700 transition-colors"
                                        title="Edit Routine"
                                    >
                                        <Dumbbell size={16} />
                                    </button>
                                    <button
                                        onClick={() => onDelete(routine.id)}
                                        className="bg-red-600 text-white p-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                                        title="Delete Routine"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 space-y-1 text-sm text-gray-400">
                                {routine.exercises.map((ex, index) => (
                                    <p key={index} className="pl-4 border-l-2 border-gray-700">
                                        • {ex.name} ({ex.sets}x{ex.reps} @ {ex.weight} kg/lbs)
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const HistoryScreen = ({ logs }) => {
    return (
        <div className="space-y-6 pb-20 sm:pb-0">
            <h2 className="text-2xl font-semibold text-white border-b border-gray-700 pb-2">Workout History</h2>
            
            {logs.length === 0 ? (
                <div className="text-center p-12 bg-gray-700 rounded-xl text-gray-300">
                    <History size={40} className="mx-auto mb-3 text-gray-400" />
                    <p>No workouts logged yet. Start a routine or log a new workout!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {logs.map(log => (
                        <div key={log.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl shadow-md">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                                <h3 className="text-xl font-bold text-blue-400">{log.routineName}</h3>
                                <span className="text-sm text-gray-400">
                                    {new Date(log.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="mt-2 space-y-1 text-sm text-gray-300">
                                {Array.isArray(log.exercises) && log.exercises.map((ex, index) => (
                                    <p key={index} className="pl-4 border-l-2 border-green-600">
                                        <span className="font-semibold">{ex.name}</span>: {ex.completedSets} sets @ {ex.weight} kg/lbs x {ex.completedReps} reps
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    const [user, setUser] = useState(null);
    const [username, setUsername] = useState('Guest');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [view, setView] = useState('dashboard'); 
    const [routines, setRoutines] = useState([]);
    const [logs, setLogs] = useState([]);
    const [customExercises, setCustomExercises] = useState([]); 
    const [routineToEditId, setRoutineToEditId] = useState(null); 
    const [routineToStartId, setRoutineToStartId] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [toastType, setToastType] = useState('success');
    const [isFormOpen, setIsFormOpen] = useState(false); 
    const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false); 
    const [selectedExercise, setSelectedExercise] = useState(null);

    // Determines if the user is authenticated (Firebase user object exists)
    const isLoggedIn = !!user; 

    const showToast = (message, type = 'success') => {
      setToastMessage(message);
      setToastType(type);
      setTimeout(() => setToastMessage(null), 3000);
    };

    // 1. Firebase Authentication Listener
    useEffect(() => {
        if (!auth) {
            setIsAuthReady(true);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthReady(true);
        });
        
        // This is a placeholder for the initial sign-in logic when running outside the canvas
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
             signInWithCustomToken(auth, __initial_auth_token).catch(() => signInAnonymously(auth));
        }

        return () => unsubscribe();
    }, []);

    // 2. Username Listener
    useEffect(() => {
        if (!isAuthReady || !user || !db) {
            setUsername('Guest');
            return;
        }
        
        const userRef = doc(db, "artifacts", appId, "users", user.uid);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().username) {
                setUsername(docSnap.data().username);
            } else {
                setUsername('User ID: ' + user.uid.substring(0, 8) + '...');
            }
        }, (error) => {
            console.error("Error fetching username:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, user]);

    // 3. Data Fetching (Routines, Logs, and Custom Exercises)
    useEffect(() => {
        if (!isAuthReady || !user || !db) {
             setRoutines([]);
             setLogs([]);
             setCustomExercises([]);
             return;
        }

        const userId = user.uid;
        
        // Routines Listener
        const routinesPath = collection(db, "artifacts", appId, "users", userId, "routines");
        const unsubscribeRoutines = onSnapshot(routinesPath, (snapshot) => {
            const fetchedRoutines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedRoutines.sort((a, b) => a.name.localeCompare(b.name));
            setRoutines(fetchedRoutines);
        }, (error) => {
            console.error("Error fetching routines:", error);
            showToast("Failed to load routines.", 'error');
        });

        // Logs Listener
        const logsPath = collection(db, "artifacts", appId, "users", userId, "logs");
        const unsubscribeLogs = onSnapshot(logsPath, (snapshot) => {
            const fetchedLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp instanceof Date ? doc.data().timestamp.toISOString() : doc.data().timestamp
            }));
            fetchedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setLogs(fetchedLogs);
        }, (error) => {
            console.error("Error fetching logs:", error);
            showToast("Failed to load workout history.", 'error');
        });

        // Custom Exercises Listener
        const customExPath = collection(db, "artifacts", appId, "users", userId, "custom_exercises");
        const unsubscribeCustomEx = onSnapshot(customExPath, (snapshot) => {
            const fetchedCustomEx = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomExercises(fetchedCustomEx);
        }, (error) => {
            console.error("Error fetching custom exercises:", error);
            showToast("Failed to load custom exercises.", 'error');
        });

        return () => {
            unsubscribeRoutines();
            unsubscribeLogs();
            unsubscribeCustomEx();
        };
    }, [isAuthReady, user]);

    // 4. Save Routine (Add or Edit)
    const handleSaveRoutine = async (routineData) => {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;

      try {
        if (routineToEditId) {
          const routineRef = doc(db, "artifacts", appId, "users", userId, "routines", routineToEditId);
          await updateDoc(routineRef, routineData); 
          showToast("Routine updated successfully!");
        } else {
          const collectionPath = collection(db, "artifacts", appId, "users", userId, "routines");
          await addDoc(collectionPath, { ...routineData, userId: userId });
          showToast("Routine created successfully!");
        }
        setRoutineToEditId(null); 
        setIsFormOpen(false); 
      } catch (error) {
        console.error("Error saving routine: ", error);
        showToast("Error saving routine. Please try again.", 'error');
      }
    };

    // 5. Add Custom Exercise (New Logic)
    const handleAddCustomExercise = async (exerciseData) => {
        if (!auth.currentUser) return;
        const userId = auth.currentUser.uid;

        try {
            const collectionPath = collection(db, "artifacts", appId, "users", userId, "custom_exercises");
            await addDoc(collectionPath, { ...exerciseData, userId: userId });
            showToast(`Exercise "${exerciseData.name}" added!`);
            setIsAddExerciseOpen(false);
        } catch (error) {
            console.error("Error adding custom exercise: ", error);
            showToast("Error adding exercise. Please try again.", 'error');
        }
    };

    // 6. Log Workout
    const handleLogWorkout = async (logData) => {
        if (!auth.currentUser) return;
        const userId = auth.currentUser.uid;

        try {
            const logEntry = {
                ...logData,
                userId: userId,
                timestamp: new Date().toISOString(),
            };
            const collectionPath = collection(db, "artifacts", appId, "users", userId, "logs");
            await addDoc(collectionPath, logEntry);
            showToast("Workout logged successfully!");
            setRoutineToStartId(null);
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error logging workout: ", error);
            showToast("Error logging workout. Please try again.", 'error');
        }
    };

    // 7. Handlers for UI state transitions
    const handleEditRoutine = (id) => {
      setRoutineToEditId(id);
      setRoutineToStartId(null);
      setIsFormOpen(true);
    };

    const handleDeleteRoutine = async (id) => {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;

      if (!window.confirm("Are you sure you want to delete this routine?")) return;

      try {
        const docRef = doc(db, "artifacts", appId, "users", userId, "routines", id);
        await deleteDoc(docRef);
        showToast("Routine deleted successfully!");
      } catch (error) {
        console.error("Error deleting routine: ", error);
        showToast("Error deleting routine. Please try again.", 'error');
      }
    };
    
    const handleStartWorkout = (routineId = null) => {
      setRoutineToStartId(routineId);
      setRoutineToEditId(null);
      setIsFormOpen(true);
    }

    // 8. Render Content based on View
    let content;
    if (!isAuthReady) {
        content = (
            <div className="flex justify-center items-center h-96 text-lg font-medium text-gray-400">
                Loading Application...
            </div>
        );
    } else if (!isLoggedIn) {
        // Pass a function to set the main App state (isLoggedIn)
        content = <AuthScreen showToast={showToast} setIsLoggedIn={() => setUser(auth.currentUser)} />; 
    } else {
      switch (view) {
        case 'dashboard':
          content = <DashboardScreen routines={routines} onLog={handleStartWorkout} setView={setView} username={username} />;
          break;
        case 'routines':
          content = <RoutinesScreen routines={routines} onLog={handleStartWorkout} onEdit={handleEditRoutine} onDelete={handleDeleteRoutine} setView={setView} />;
          break;
        case 'history':
          content = <HistoryScreen logs={logs} />;
          break;
        case 'exercises':
          content = <ExerciseScreen logs={logs} customExercises={customExercises} selectedExercise={selectedExercise} setSelectedExercise={setSelectedExercise} setIsAddFormOpen={setIsAddExerciseOpen} />;
          break;
        default:
          content = <DashboardScreen routines={routines} onLog={handleStartWorkout} setView={setView} username={username} />;
      }
    }

    // 9. Determine Modal Content
    let modalContent = null;
    if (isFormOpen) {
      if (routineToEditId) {
        const routine = routines.find(r => r.id === routineToEditId);
        modalContent = (
          <RoutineForm routineToEdit={routine} onSave={handleSaveRoutine} onCancel={() => { setRoutineToEditId(null); setIsFormOpen(false); }} />
        );
      } else {
        modalContent = (
          <LogWorkoutForm routines={routines} routineToStartId={routineToStartId} onLog={handleLogWorkout} onCancel={() => { setRoutineToStartId(null); setIsFormOpen(false); }} showToast={showToast} />
        );
      }
    } else if (isAddExerciseOpen) {
        modalContent = (
            <AddExerciseForm onSave={handleAddCustomExercise} onCancel={() => setIsAddExerciseOpen(false)} />
        );
    }


    // Main Layout
    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            {/* Render AuthScreen if not logged in */}
            {!isLoggedIn && content}

            {/* Main App Content if logged in */}
            {isLoggedIn && (
                <>
                    <header className="hidden sm:block p-4 border-b border-gray-700 bg-gray-800 shadow-sm">
                        <div className="max-w-4xl mx-auto flex justify-between items-center">
                            <h1 className="text-2xl font-extrabold text-blue-500 tracking-tight flex items-center">
                                <Zap size={28} className="mr-2" /> Fitness Tracker
                            </h1>
                            <div className="flex space-x-6 text-gray-400">
                                {['dashboard', 'routines', 'history', 'exercises'].map(v => (
                                    <button 
                                        key={v}
                                        onClick={() => {
                                            setView(v);
                                            setSelectedExercise(null);
                                        }}
                                        className={`font-medium capitalize py-2 transition-colors ${view === v ? 'text-blue-500 border-b-2 border-blue-500' : 'hover:text-blue-400'}`}
                                    >
                                        {v === 'dashboard' ? 'Home' : v}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-300 font-medium">{username}</span>
                                <button 
                                    onClick={() => auth.signOut()}
                                    className="text-red-500 hover:text-red-400 text-sm font-medium"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-4xl mx-auto p-0 sm:p-8 pt-0 sm:pt-8">
                        <div className="bg-gray-800 rounded-xl shadow-2xl min-h-[70vh] w-full p-4 sm:p-8 mt-4 sm:mt-0 pb-20 sm:pb-8">
                            {content}
                        </div>
                    </main>

                    {/* Mobile Navigation */}
                    <BottomNav currentView={view} setView={setView} setSelectedExercise={setSelectedExercise} />
                </>
            )}

            {/* Modals/Forms */}
            {isLoggedIn && modalContent}

            {/* Toast Notification */}
            {toastMessage && (
              <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />
            )}
        </div>
    );
}





