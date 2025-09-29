document.addEventListener('DOMContentLoaded', () => {
    // --- FIREBASE SETUP ---
    // PASTE YOUR COPIED FIREBASE CONFIG OBJECT HERE
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
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // --- EDAMAM API KEYS ---
    const EDAMAM_APP_ID = 'b12bf96c';
    const EDAMAM_APP_KEY = 'f1dbfd8a80fa0f7d42f61a93d7527182';

    // --- GLOBAL STATE ---
    let currentUser = null;
    let workoutHistory = [];
    let dailyFoods = {};
    let currentWorkout = [];
    let goals = {};
    let selectedFoodData = null;
    let progressChart, calorieHistoryChart, proteinHistoryChart, carbHistoryChart, fatHistoryChart;
    const exerciseList = {
        "Chest": ["Barbell Bench Press", "Incline Barbell Bench Press", "Decline Barbell Bench Press", "Dumbbell Bench Press", "Incline Dumbbell Press", "Decline Dumbbell Press", "Push-ups", "Dips", "Dumbbell Flyes", "Incline Dumbbell Flyes", "Cable Crossover", "Machine Chest Press", "Pec Deck Machine"],
        "Back": ["Deadlift", "Pull-ups", "Chin-ups", "Bent-over Barbell Row", "Pendlay Row", "Dumbbell Row", "T-bar Row", "Seated Cable Row", "Lat Pulldown", "Good Mornings", "Back Extension", "Rack Pulls"],
        "Legs (Quads, Hamstrings, Glutes)": ["Barbell Squat", "Front Squat", "Goblet Squat", "Leg Press", "Hack Squat", "Lunges", "Bulgarian Split Squat", "Romanian Deadlift", "Stiff-legged Deadlift", "Leg Curls", "Leg Extensions", "Glute Bridges", "Hip Thrusts"],
        "Shoulders": ["Overhead Press (Barbell)", "Seated Dumbbell Press", "Arnold Press", "Lateral raises", "Front Raises", "Bent-over Dumbbell Raise", "Upright Row", "Face Pulls", "Barbell Shrugs", "Dumbbell Shrugs"],
        "Biceps": ["Barbell Curl", "Dumbbell Curl", "Alternating Dumbbell Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl", "Cable Curl", "Chin-ups"],
        "Triceps": ["Close-grip Bench Press", "Dips", "Tricep Pushdowns", "Overhead Tricep Extension (Dumbbell/Cable)", "Skull Crushers", "Tricep Kickbacks", "Diamond Push-ups"],
        "Calves": ["Standing Calf Raises", "Seated Calf Raises", "Leg Press Calf Raises"],
        "Abs": ["Crunches", "Leg Raises", "Plank", "Side Plank", "Russian Twist", "Hanging Leg Raises", "Cable Crunches"],
        "Forearms": ["Wrist Curls", "Reverse Wrist Curls", "Farmer's Walk"]
    };

    // --- DOM ELEMENTS ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const signoutBtn = document.getElementById('signout-btn');
    const authError = document.getElementById('auth-error');
    const showWorkoutTabBtn = document.getElementById('show-workout-tab');
    const showFoodTabBtn = document.getElementById('show-food-tab');
    const workoutTabContent = document.getElementById('workout-tab-content');
    const foodTabContent = document.getElementById('food-tab-content');
    const foodSearchForm = document.getElementById('food-search-form');
    const searchResultsContainer = document.getElementById('search-results-container');
    const selectedFoodContainer = document.getElementById('selected-food-container');
    const workoutForm = document.getElementById('workout-form');
    const exerciseSelect = document.getElementById('exercise-select');
    const customExerciseContainer = document.getElementById('custom-exercise-container');
    const customExerciseNameInput = document.getElementById('custom-exercise-name');
    const currentWorkoutList = document.getElementById('current-workout-list');
    const saveWorkoutBtn = document.getElementById('save-workout-btn');
    const workoutHistoryList = document.getElementById('workout-history-list');
    const dailyFoodLog = document.getElementById('daily-food-log');
    const dailySummary = document.getElementById('daily-summary');
    const chartPlaceholder = document.getElementById('chart-placeholder');
    const progressChartCtx = document.getElementById('progress-chart').getContext('2d');
    const calorieHistoryChartCtx = document.getElementById('calorie-history-chart').getContext('2d');
    const proteinHistoryChartCtx = document.getElementById('protein-history-chart').getContext('2d');
    const carbHistoryChartCtx = document.getElementById('carb-history-chart').getContext('2d');
    const fatHistoryChartCtx = document.getElementById('fat-history-chart').getContext('2d');
    const goalsForm = document.getElementById('goals-form');

    // --- AUTHENTICATION LOGIC ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            await loadData();
            authContainer.style.display = 'none';
            appContainer.style.display = 'block';
        } else {
            currentUser = null;
            authContainer.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    const handleAuth = async (action) => {
        const email = emailInput.value;
        const password = passwordInput.value;
        authError.textContent = '';
        try {
            if (action === 'signup') {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            authError.textContent = error.message;
        }
    };

    // --- TAB SWITCHING LOGIC ---
    const handleTabSwitch = (tab) => {
        workoutTabContent.classList.remove('active');
        foodTabContent.classList.remove('active');
        showWorkoutTabBtn.classList.remove('active');
        showFoodTabBtn.classList.remove('active');
        if (tab === 'workout') {
            workoutTabContent.classList.add('active');
            showWorkoutTabBtn.classList.add('active');
        } else {
            foodTabContent.classList.add('active');
            showFoodTabBtn.classList.add('active');
        }
    };

    // --- FIRESTORE DATA HANDLING ---
    const saveData = async () => {
        if (!currentUser) return;
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.set({ workoutHistory, dailyFoods, currentWorkout, goals });
        } catch (error) {
            console.error("Error saving data:", error);
        }
    };

    const loadData = async () => {
        if (!currentUser) return;
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            const doc = await userRef.get();
            if (doc.exists) {
                const data = doc.data();
                workoutHistory = data.workoutHistory || [];
                dailyFoods = data.dailyFoods || {};
                currentWorkout = data.currentWorkout || [];
                goals = data.goals || {};
            } else {
                workoutHistory = [];
                dailyFoods = {};
                currentWorkout = [];
                goals = {};
            }
            renderAll();
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    const renderAll = () => {
        populateExerciseDropdown();
        renderDailyFoods();
        renderCurrentWorkout();
        renderWorkoutHistory();
        renderCalorieHistoryChart();
        renderProteinHistoryChart();
        renderCarbHistoryChart();
        renderFatHistoryChart();
        renderGoals();
    };

    const renderGoals = () => {
        document.getElementById('goal-calories').value = goals.calories || '';
        document.getElementById('goal-protein').value = goals.protein || '';
        document.getElementById('goal-carbs').value = goals.carbs || '';
        document.getElementById('goal-fat').value = goals.fat || '';
    };

    // --- FOOD TRACKER FUNCTIONS ---
    const getTodayKey = () => new Date().toISOString().split('T')[0];

    const searchFood = async (query) => {
        if (EDAMAM_APP_ID === 'YOUR_EDAMAM_APP_ID_HERE' || EDAMAM_APP_KEY === 'YOUR_EDAMAM_APP_KEY_HERE') {
            alert('Please add your Edamam App ID and Key to the script.js file.');
            return;
        }
        searchResultsContainer.innerHTML = `<p class="placeholder">Searching...</p>`;
        const url = `https://api.edamam.com/api/food-database/v2/parser?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&ingr=${encodeURIComponent(query)}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.hints && data.hints.length > 0) {
                displaySearchResults(data.hints);
            } else {
                searchResultsContainer.innerHTML = `<p class="placeholder">No results found.</p>`;
            }
        } catch (error) {
            console.error("API Error:", error);
            searchResultsContainer.innerHTML = `<p class="placeholder">Error fetching data.</p>`;
        }
    };

    const displaySearchResults = (hints) => {
        searchResultsContainer.innerHTML = '';
        hints.forEach(hint => {
            const food = hint.food;
            const item = document.createElement('div');
            item.className = 'search-result-item';
            let brandText = food.brand ? `<div class="result-brand">${food.brand}</div>` : '';
            item.innerHTML = `<div>${food.label}${brandText}</div>`;
            item.addEventListener('click', () => selectFood(food, hint.measures));
            searchResultsContainer.appendChild(item);
        });
    };

    const selectFood = (food, measures) => {
        const nutrients = food.nutrients;
        const nutrientsPer100g = {
            calories: nutrients.ENERC_KCAL || 0, protein: nutrients.PROCNT || 0,
            fat: nutrients.FAT || 0, carbs: nutrients.CHOCDF || 0,
        };
        selectedFoodData = { name: food.label, nutrientsPer100g: nutrientsPer100g };
        searchResultsContainer.innerHTML = '';
        selectedFoodContainer.style.display = 'block';
        let servingInfoText = '';
        const primaryMeasure = measures.find(m => m.label.toLowerCase() === 'serving') || measures[0];
        if (primaryMeasure) {
            const servingCalories = (nutrientsPer100g.calories / 100) * primaryMeasure.weight;
            servingInfoText = ` | <strong>${servingCalories.toFixed(0)} kcal</strong> per ${primaryMeasure.label}`;
        }
        let unitsOptions = `<option value="100">100 grams</option>`;
        if (measures && measures.length > 0) {
            unitsOptions += measures.map(measure => `<option value="${measure.weight}">${measure.label}</option>`).join('');
        }
        selectedFoodContainer.innerHTML = `
            <h3>${food.label}</h3>
            <p class="nutrient-info">Per 100g: <strong>${nutrientsPer100g.calories.toFixed(0)} kcal</strong>${servingInfoText}</p>
            <p class="nutrient-info">Macros per 100g: P: ${nutrientsPer100g.protein.toFixed(1)}g, C: ${nutrientsPer100g.carbs.toFixed(1)}g, F: ${nutrientsPer100g.fat.toFixed(1)}g</p>
            <div class="quantity-input-group"><input type="number" id="food-quantity" step="any" placeholder="e.g., 1.5" min="0" required><select id="food-unit">${unitsOptions}</select></div>
            <button id="add-food-btn" class="btn">Add Food</button>
        `;
        document.getElementById('add-food-btn').addEventListener('click', addFoodToLog);
        document.getElementById('food-quantity').focus();
    };

    const addFoodToLog = () => {
        const quantityInput = document.getElementById('food-quantity');
        const unitSelect = document.getElementById('food-unit');
        const quantity = parseFloat(quantityInput.value);
        const unitGramWeight = parseFloat(unitSelect.value);
        const unitText = unitSelect.options[unitSelect.selectedIndex].text;
        if (!quantity || quantity <= 0) { alert("Please enter a valid quantity."); return; }
        const totalGrams = quantity * unitGramWeight;
        const scale = totalGrams / 100;
        const base = selectedFoodData.nutrientsPer100g;
        const loggedFood = {
            name: selectedFoodData.name, quantity: quantity, unit: unitText,
            calories: base.calories * scale, protein: base.protein * scale,
            carbs: base.carbs * scale, fat: base.fat * scale,
        };
        const todayKey = getTodayKey();
        if (!dailyFoods[todayKey]) { dailyFoods[todayKey] = []; }
        dailyFoods[todayKey].push(loggedFood);
        saveData();
        renderDailyFoods();
        renderCalorieHistoryChart();
        renderProteinHistoryChart();
        renderCarbHistoryChart();
        renderFatHistoryChart();
        selectedFoodContainer.innerHTML = '';
        selectedFoodContainer.style.display = 'none';
        document.getElementById('food-search-input').value = '';
    };

    const renderDailyFoods = () => {
        const todayKey = getTodayKey();
        const foods = dailyFoods[todayKey] || [];
        dailySummary.innerHTML = '';
        if (foods.length === 0) {
            dailyFoodLog.innerHTML = `<p class="placeholder">No food logged for today.</p>`;
            return;
        }
        let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        const foodList = document.createElement('ul');
        const removeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        foods.forEach((food, index) => {
            totalCals += food.calories;
            totalProtein += food.protein;
            totalCarbs += food.carbs;
            totalFat += food.fat;
            const li = document.createElement('li');
            li.innerHTML = `<div class="food-item-details"><div class="list-item-main">${food.name}</div><div class="list-item-details">${food.quantity} ${food.unit} - ${Math.round(food.calories)} kcal</div></div><button class="btn-remove" data-index="${index}">${removeIconSVG}</button>`;
            foodList.appendChild(li);
        });
        dailyFoodLog.innerHTML = '';
        dailyFoodLog.appendChild(foodList);
        const calGoal = goals.calories ? ` / ${goals.calories}` : '';
        const proGoal = goals.protein ? ` / ${goals.protein}g` : 'g';
        const carbGoal = goals.carbs ? ` / ${goals.carbs}g` : 'g';
        const fatGoal = goals.fat ? ` / ${goals.fat}g` : 'g';
        dailySummary.innerHTML = `
            <p><span>Total Calories:</span> <strong>~${Math.round(totalCals)}<span class="summary-goal">${calGoal}</span></strong></p>
            <p><span>Protein:</span> <strong>${Math.round(totalProtein)}<span class="summary-goal">${proGoal}</span></strong></p>
            <p><span>Carbs:</span> <strong>${Math.round(totalCarbs)}<span class="summary-goal">${carbGoal}</span></strong></p>
            <p><span>Fat:</span> <strong>${Math.round(totalFat)}<span class="summary-goal">${fatGoal}</span></strong></p>
        `;
    };

    // --- WORKOUT TRACKER FUNCTIONS ---
    const populateExerciseDropdown = () => {
        exerciseSelect.innerHTML = `<option value="">Choose an exercise...</option>`;
        for (const group in exerciseList) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group;
            exerciseList[group].forEach(exercise => {
                const option = document.createElement('option');
                option.value = exercise;
                option.textContent = exercise;
                optgroup.appendChild(option);
            });
            exerciseSelect.appendChild(optgroup);
        }
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '— Add new exercise —';
        exerciseSelect.appendChild(customOption);
    };

    const renderCurrentWorkout = () => {
        currentWorkoutList.innerHTML = '';
        if (currentWorkout.length === 0) {
            currentWorkoutList.innerHTML = `<p class="placeholder">Your current workout is empty.</p>`;
            return;
        }
        currentWorkout.forEach((exercise, index) => {
            const li = document.createElement('li');
            const removeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            li.innerHTML = `<div><div class="list-item-main">${exercise.name}</div><div class="list-item-details">${exercise.sets} sets, ${exercise.reps} reps @ ${exercise.weight}</div></div><button class="btn-remove" data-index="${index}">${removeIconSVG}</button>`;
            currentWorkoutList.appendChild(li);
        });
    };

    const renderWorkoutHistory = () => {
        workoutHistoryList.innerHTML = '';
        if (workoutHistory.length === 0) {
            workoutHistoryList.innerHTML = `<p class="placeholder">No saved workouts yet.</p>`;
            return;
        }
        workoutHistory.forEach(workout => {
            const li = document.createElement('li');
            const date = new Date(workout.date).toLocaleDateString();
            li.innerHTML = `<div class="list-item-main">Workout on ${date} <span class="list-item-details">(${workout.exercises.length} exercises)</span></div>`;
            const ul = document.createElement('ul');
            workout.exercises.forEach(ex => {
                const exLi = document.createElement('li');
                exLi.className = 'exercise-details-history';
                exLi.textContent = `${ex.name} - ${ex.sets}x${ex.reps} @ ${ex.weight}`;
                exLi.addEventListener('click', () => renderProgressChart(ex.name));
                ul.appendChild(exLi);
            });
            li.appendChild(ul);
            workoutHistoryList.prepend(li);
        });
    };
    
    // --- CHART RENDERING FUNCTIONS ---
    const renderProgressChart = (exerciseName) => {
        const dataPoints = workoutHistory.flatMap(w => w.exercises.map(ex => ({ ...ex, date: w.date }))).filter(ex => ex.name.toLowerCase() === exerciseName.toLowerCase()).sort((a, b) => new Date(a.date) - new Date(b.date));
        if (dataPoints.length > 1) {
            chartPlaceholder.style.display = 'none';
            document.getElementById('progress-chart').style.display = 'block';
            if (progressChart) progressChart.destroy();
            progressChart = new Chart(progressChartCtx, {
                type: 'line',
                data: {
                    labels: dataPoints.map(d => new Date(d.date).toLocaleDateString()),
                    datasets: [{ label: `Weight Progression for ${exerciseName}`, data: dataPoints.map(d => d.weight), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.2 }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        } else {
            chartPlaceholder.textContent = `Not enough data to chart "${exerciseName}". Log it at least twice.`;
            chartPlaceholder.style.display = 'block';
            document.getElementById('progress-chart').style.display = 'none';
        }
    };
    
    const getWeeklyNutritionData = () => {
        const labels = [], calorieData = [], proteinData = [], carbData = [], fatData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            labels.push(date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            const foods = dailyFoods[dateKey] || [];
            let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
            foods.forEach(food => { 
                totalCals += food.calories; totalProtein += food.protein; 
                totalCarbs += food.carbs; totalFat += food.fat;
            });
            calorieData.push(totalCals); proteinData.push(totalProtein);
            carbData.push(totalCarbs); fatData.push(totalFat);
        }
        return { labels, calorieData, proteinData, carbData, fatData };
    };

    const createBarChart = (ctx, chartInstance, data, color, showXAxisLabels) => {
        if (chartInstance) { chartInstance.destroy(); }
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{ 
                    label: '', 
                    data: data.values, 
                    backgroundColor: `rgba(${color}, 0.5)`, 
                    borderColor: `rgba(${color}, 1)`,
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { color: '#9ca3af' }, 
                        grid: { color: 'rgba(55, 65, 81, 0.5)' } 
                    },
                    x: {
                        ticks: { 
                            color: '#9ca3af',
                            callback: function(value, index, ticks) {
                                // Only show the label if showXAxisLabels is true
                                return showXAxisLabels ? this.getLabelForValue(value) : '';
                            }
                        },
                        grid: { color: 'rgba(55, 65, 81, 0.5)' }
                    }
                }
            }
        });
    };

    const renderCalorieHistoryChart = () => {
        const { labels, calorieData } = getWeeklyNutritionData();
        calorieHistoryChart = createBarChart(calorieHistoryChartCtx, calorieHistoryChart, { labels: labels, values: calorieData }, '59, 130, 246', false);
    };
    const renderProteinHistoryChart = () => {
        const { labels, proteinData } = getWeeklyNutritionData();
        proteinHistoryChart = createBarChart(proteinHistoryChartCtx, proteinHistoryChart, { labels: labels, values: proteinData }, '52, 211, 153', false);
    };
    const renderCarbHistoryChart = () => {
        const { labels, carbData } = getWeeklyNutritionData();
        carbHistoryChart = createBarChart(carbHistoryChartCtx, carbHistoryChart, { labels: labels, values: carbData }, '251, 191, 36', false);
    };
    const renderFatHistoryChart = () => {
        const { labels, fatData } = getWeeklyNutritionData();
        // The last chart will show the X-axis labels for all of them.
        fatHistoryChart = createBarChart(fatHistoryChartCtx, fatHistoryChart, { labels: labels, values: fatData }, '248, 113, 113', true);
    };

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', () => handleAuth('login'));
    signupBtn.addEventListener('click', () => handleAuth('signup'));
    signoutBtn.addEventListener('click', () => auth.signOut());
    showWorkoutTabBtn.addEventListener('click', () => handleTabSwitch('workout'));
    showFoodTabBtn.addEventListener('click', () => handleTabSwitch('food'));
    foodSearchForm.addEventListener('submit', (e) => { e.preventDefault(); const query = document.getElementById('food-search-input').value.trim(); if (query) { searchFood(query); selectedFoodContainer.style.display = 'none'; } });
    dailyFoodLog.addEventListener('click', (e) => { const removeButton = e.target.closest('.btn-remove'); if (removeButton) { const index = parseInt(removeButton.dataset.index, 10); const todayKey = getTodayKey(); if (dailyFoods[todayKey]) { dailyFoods[todayKey].splice(index, 1); saveData(); renderDailyFoods(); renderCalorieHistoryChart(); renderProteinHistoryChart(); renderCarbHistoryChart(); renderFatHistoryChart(); } } });
    exerciseSelect.addEventListener('change', () => { if (exerciseSelect.value === 'custom') { customExerciseContainer.style.display = 'block'; customExerciseNameInput.focus(); } else { customExerciseContainer.style.display = 'none'; } });
    workoutForm.addEventListener('submit', (e) => { e.preventDefault(); let exerciseName; if (exerciseSelect.value === 'custom') { exerciseName = customExerciseNameInput.value.trim(); if (!exerciseName) { alert('Please enter a name for your custom exercise.'); return; } } else { exerciseName = exerciseSelect.value; } if (!exerciseName) { alert('Please select an exercise.'); return; } const exercise = { name: exerciseName, sets: parseFloat(document.getElementById('sets').value), reps: parseFloat(document.getElementById('reps').value), weight: parseFloat(document.getElementById('weight').value) || 0, }; currentWorkout.push(exercise); renderCurrentWorkout(); saveData(); workoutForm.reset(); customExerciseContainer.style.display = 'none'; exerciseSelect.value = ''; });
    currentWorkoutList.addEventListener('click', (e) => { const removeButton = e.target.closest('.btn-remove'); if (removeButton) { const index = removeButton.dataset.index; currentWorkout.splice(index, 1); renderCurrentWorkout(); saveData(); } });
    saveWorkoutBtn.addEventListener('click', () => { if (currentWorkout.length === 0) { alert("Your current workout is empty!"); return; } const workout = { date: new Date().toISOString(), exercises: currentWorkout }; workoutHistory.push(workout); currentWorkout = []; saveData(); renderCurrentWorkout(); renderWorkoutHistory(); alert("Workout saved successfully!"); });
    goalsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goals = {
            calories: parseFloat(document.getElementById('goal-calories').value) || 0,
            protein: parseFloat(document.getElementById('goal-protein').value) || 0,
            carbs: parseFloat(document.getElementById('goal-carbs').value) || 0,
            fat: parseFloat(document.getElementById('goal-fat').value) || 0,
        };
        saveData();
        renderDailyFoods();
        alert('Goals saved!');
    });
});