'use strict';

// prettier-ignore
const form = document.querySelector('.form');
const formBtn = document.querySelector('.form__btn');
const sidebar = document.querySelector('.sidebar');

// const map = document.querySelector('#map');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
    date = new Date();
    id = String(Date.now()).slice(-5); // unique ID

    constructor(coords, distance, duration) {
        this.coords = coords;
        this.distance = distance;
        this.duration = duration;
    }

    _setDescription() {
        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`
    }
};

class Running extends Workout {
    type = 'running';
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this._setDescription();
    }

    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace;
    }
};


class Cycling extends Workout {
    type = 'cycling';
    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this._setDescription();
    }

    calcSpeed() {
        this.speed = this.distance / (this.duration/60);
        return this.speed;
    }
};

class App {
    #map; // in this div element, we store whole leaflet liblary map
    #mapEvent; // what happens when we click on map (leaflet library)
    #workoutsArr = []; // our workout objects are stored in this array
    #markersArr = []; // markers are seperately stored in  this array, bcs leaflet library has specific methods on markers only (remove method for example)
    #mapZoomLevel = 13; // default zoom lvl
    

    constructor() {
        
        this._getPosition(); // gets client's location with Geolocation API

        form.addEventListener('submit', this._newWorkout.bind(this)); // .bind(this) <-- is used, bcs if we don't bind, 'this' will aim for eventListener itself and not the method
            
        inputType.addEventListener('change', this._toggleElevationField); // toggling between cycling/running

        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

        containerWorkouts.addEventListener('change',this._editWorkoutInfo.bind(this)); // Whenever we change values in our workouts, this event listener is triggered

        // getting data from Lstorage
        this._getLocalStorage();

        // Implementing Reset button 
        const resetHTML = '<span class="workout-reset hidden">Reset &orarr;</span>';
        sidebar.insertAdjacentHTML('afterbegin', resetHTML);
        const resetEl = document.querySelector('.workout-reset');
        resetEl.addEventListener('click', this.reset);
        if(this.#workoutsArr.length > 0) {resetEl.classList.remove('hidden')};


        // This part of code brings weather data and manipulates with it everytime our app is refreshed
        this.#workoutsArr.forEach(eachMemb => {
            const getWeather = async function() { 
            try {
                    const lat = eachMemb.coords[0];
                    const lon = eachMemb.coords[1];
                    const key = '269dbe2bd46b4f1d7ce0ff26bdc1e66e'
                    const promise = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&exclude=hourly, daily&appid=${key}`);
                    if(!promise.ok) throw new Error('Something went wrong')
                    const data = await promise.json();
                    return data;
                } catch(err) {
                    console.log(err);
                    throw err;
                }
            };
    
            (async function () {
                try {
                    const info = await getWeather();
                    
                    const box = document.querySelectorAll('.workout');
                    box.forEach(memb => {
                        if(memb.dataset.id === eachMemb.id && eachMemb.coords[0].toFixed(4) == info.coord.lat) {
                            memb.querySelector('.weatherLocation').innerHTML =`${info.name}, ${info.sys.country} `;
                            memb.querySelector('.weatherCondition').innerHTML = `${info.weather[0].description.toUpperCase()}`;
                            memb.querySelector('.weatherIcon').src = `http://openweathermap.org/img/wn/${info.weather[0].icon}@2x.png`;
                        }
                    })
                } catch(err) {
                    console.log(err);
                }
            })();
        })
        // if(form.classList.contains('hidden')) {}
    };


        // Using Geolocation API for determining client's coordinates
    _getPosition() {
        if (navigator.geolocation)
        navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), function() {
            alert(`Could not get location`)
        })
    };

    _loadMap(position) {
            // we're using simple destructuring down, bcs position.coords is an object
            const { latitude, longitude } = position.coords; 
            const coords = [latitude, longitude];
            this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
        
            // 'tileLayer' is the way the map looks, we can change it from leaflet layer library if we want in the future
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.#map);
        
            // This 'on' method is coming from leaflet library, it is similar to addEventListener and listens for clicks on map
            // Handling clicks
            this.#map.on('click', this._showForm.bind(this));

            // rendering saved workouts on map
            this.#workoutsArr.forEach(work => {
                this._renderWorkoutMarker(work);
              });
    }

    _showForm(mapE) {
            this.#mapEvent = mapE;
                form.classList.remove('hidden'); // form is hidden until we click on map
                inputDistance.focus();
    };

    _hideForm() {
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => {
            form.style.display = 'grid'
        }, 1000);
    }

    _toggleElevationField() {
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
                inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    }

    _newWorkout(e) {
        const validInputs = (...inputs) => 
            inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        e.preventDefault();
        
        // Get data from form
        const type = inputType.value;
        const distance = +inputDistance.value; // "+" operator converts value into number, we need numbers!
        const duration = +inputDuration.value;
        const { lat, lng } = this.#mapEvent.latlng; // same destructuring, just like we used above
        let workout; // variable for storing workout objects
        
        // Check if data is valid
        // If workout is running, create new running object
        if (type === 'running') {
            const cadence = +inputCadence.value;

            if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence)) 
            return alert('Please, input only real numbers')

            workout = new Running([lat,lng], distance, duration, cadence);
        };

        // If workout is cycling, create new cycling object
        if (type === 'cycling') {
            const elevation = +inputElevation.value;

            if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration)) 
            return alert('Please, input only real numbers')

            workout = new Cycling([lat,lng], distance, duration, elevation);
        };

        // Add new object to workout array
        this.#workoutsArr.push(workout);
        
        // Render workout on map as marker
        this._renderWorkoutMarker(workout)

        // Everytime we create new workout, _renderWeather fetches new workout's weather data + refreshes all other workouts that were created before
        this._renderWeather(this.#workoutsArr)

        // Render workout on list
        this._renderWorkout(workout);
        
        // Clear Fields
        this._hideForm();

        // Set local storage
        this._setLocalStorage();

        document.querySelector('.workout-reset').classList.remove('hidden'); // Reset button will be visible when workout is created, otherwise it's hidden
    }

    _renderWorkoutMarker(workout) {

    const layer = L.marker(workout.coords)
              .addTo(this.#map)
              .bindPopup(L.popup({
                  maxWidth: 250,
                  minWidth: 100,
                  autoClose: false,
                  closeOnClick: false,
                  className: `${workout.type}-popup`
              }))
              .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️'  : '🚴‍♀️'} ${workout.description}`)
              .openPopup()

              // Adding marker into marker array so we can delete it when pressed delete button
              this.#markersArr.push(layer);
    }
    
    _removeWorkoutMarker(workout) {
        this.#markersArr.forEach(marker => {
            if(workout.coords[0] === marker._latlng.lat && workout.coords[1] === marker._latlng.lng) {
                this.#markersArr[this.#markersArr.indexOf(marker)].remove();
                this.#markersArr.splice(this.#markersArr.indexOf(marker), this.#markersArr.indexOf(marker)+1);
            };
        })
        
    }

    _getId(e) {
        // get workout element on click
        const parent = e.target.closest('.workout');
        if(parent) {
            const id = parent.dataset.id;
            const foundWorkout = this.#workoutsArr.find(memb => memb.id === id);
            const workoutIndex = this.#workoutsArr.indexOf(foundWorkout);
            return  [id, foundWorkout, workoutIndex, parent] 
        } return []
        
    }

    _editWorkoutInfo(e) {
        const [id, foundWorkout, workoutIndex , parent] = this._getId(e);

        if(!id) return;

        const typeOfInput = e.target.dataset.type;
        const newInputValue = Number(e.target.value);
        let type;

        foundWorkout[typeOfInput] = newInputValue;


        if(foundWorkout.type ==='running') {
            foundWorkout.pace = foundWorkout.duration / foundWorkout.distance;
            type = 'pace';
        };

        if(foundWorkout.type === 'cycling') {
            foundWorkout.speed = foundWorkout.distance / (foundWorkout.duration/60);
            type = 'speed';
        }


        // simple validation

        if(isFinite(parent.querySelector('input[data-type="duration"]').value) &&
         isFinite(parent.querySelector('input[data-type="distance"]').value)) {

            parent.querySelector(`input[data-type="${type}"`).value = foundWorkout[type].toFixed(1);
            this._setLocalStorage();

        } 
            else {alert('Only Numbers')};
        
            // cadence and elevationGain validation 
        if(foundWorkout.type === 'running') { 
            if(isFinite(parent.querySelector('input[data-type="cadence"]').value))  {
            parent.querySelector(`input[data-type="${type}"`).value = foundWorkout[type].toFixed(1);
            this._setLocalStorage();
        } else {alert('Input Correct Cadence');
                 }
        }

        if(foundWorkout.type === 'cycling') { 
            if(isFinite(parent.querySelector('input[data-type="elevationGain"]').value))  {
            parent.querySelector(`input[data-type="${type}"`).value = foundWorkout[type].toFixed(1);
            this._setLocalStorage();
        } else {alert('Input Correct Elevation');
                }
        }

    }

    // Adding html elements (contains DELETE button)
    _renderWorkout(workout) {
        const [lat, lon] = workout.coords;
        let infoTest = {};
        let weatherArr = [];
        let something ;
        

        let html = `
    <li class="workout workout--${workout.type} " data-id="${workout.id}">

            <span class="weatherLocation weatherInfoStyle"></span> 
            <span class="weatherCondition weatherInfoStyle"></span>
            <img class="weatherIcon src="" alt="">
            <span class="workout-delete">&#10006;</span> 

        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          
          <input class="workout__value  ${workout.type === 'running' ? 'backColorRunning' : 'backColorCycling'}" value="${workout.distance}" data-type="distance" placeholder="${workout.distance}">
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <input class="workout__value  ${workout.type === 'running' ? 'backColorRunning' : 'backColorCycling'}" value="${workout.duration}" data-type="duration" placeholder="${workout.duration}">
          <span class="workout__unit">min</span>
        </div>`;

        if (workout.type === 'running') {
            html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <input class="workout__value" value="${workout.pace.toFixed(1)}" data-type="pace" disabled required size="1">
            <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <input class="workout__value  backColorRunning" value="${workout.cadence}" data-type="cadence" placeholder="${workout.cadence}">
            <span class="workout__unit">spm</span>
        </div>
    </li>`
        }

        if (workout.type === 'cycling') {
            html += `
        <div class="workout__details">
            <span class="workout__icon ">⚡️</span>
            <input class="workout__value" value="${workout.speed.toFixed(1)}" data-type="speed" disabled required size="2">
            <span class="workout__unit">km/h</span>
        </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <input class="workout__value  backColorCycling" value="${workout.elevationGain}" data-type="elevationGain"  placeholder="${workout.elevationGain}">
            <span class="workout__unit">m</span>
          </div>
    </li>`
        }

        form.insertAdjacentHTML('afterend', html);
        
        // Implementing Delete button (Deletes specific workout)
        const deleteBTN = document.querySelector('.workout-delete');
        deleteBTN.addEventListener('click', this._deleteWorkout.bind(this));

    }

    _moveToPopup(e) {
        const workoutEl = e.target.closest('.workout');
        if(!workoutEl) return;

        const workout = this.#workoutsArr.find(work=> work.id === workoutEl.dataset.id);
        this.#map.setView(workout.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1,
            }
        });
    };

    _setLocalStorage() {
        localStorage.setItem('workout', JSON.stringify(this.#workoutsArr));
    };

    _getLocalStorage() {
      const data = JSON.parse(localStorage.getItem('workout'));
      if (!data) return;

      this.#workoutsArr = data;
      
      this.#workoutsArr.forEach(work => {
          this._renderWorkout(work);
        }) ;
    }
    
    _deleteWorkout(e) {
        e.stopPropagation();
        const parent = e.target.closest('.workout');
        this.#workoutsArr.forEach(workout => {
            if(workout.id === parent.dataset.id) {
                if(this.#workoutsArr.length === 1) {this.#workoutsArr.pop()} 
                else {this.#workoutsArr.splice(this.#workoutsArr.indexOf(workout), 1);
                };
            
                parent.remove();
                this._removeWorkoutMarker(workout)
                this._setLocalStorage();
            };
        })
        if(this.#workoutsArr.length < 1) {document.querySelector('.workout-reset').classList.add('hidden')};
    }

    reset() {
        localStorage.removeItem('workout');
        location.reload();
    }

    _renderWeather(workoutArr)  {

        workoutArr.forEach(eachMemb => {
            const getWeather = async function() { 
            try {
                    const lat = eachMemb.coords[0];
                    const lon = eachMemb.coords[1];
                    const key = '269dbe2bd46b4f1d7ce0ff26bdc1e66e'
                    const promise = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&exclude=hourly, daily&appid=${key}`);
                    if(!promise.ok) throw new Error('Something went wrong')
                    const data = await promise.json();
                    return data;
                } catch(err) {
                    console.log(err);
                    throw err;
                }
            };
    
            (async function () {
                try {
                    const info = await getWeather();
                    
                    const box = document.querySelectorAll('.workout');
                    box.forEach(memb => {
                        if(memb.dataset.id === eachMemb.id && eachMemb.coords[0].toFixed(4) == info.coord.lat) {
                            memb.querySelector('.weatherLocation').innerHTML =`${info.name}, ${info.sys.country} `;
                            memb.querySelector('.weatherCondition').innerHTML = `${info.weather[0].description.toUpperCase()}`;
                            memb.querySelector('.weatherIcon').src = `http://openweathermap.org/img/wn/${info.weather[0].icon}@2x.png`;
                        }
                    })

                } catch(err) {
                    console.log(err);
                }
            })();
        })
    }
}

const app = new App();
