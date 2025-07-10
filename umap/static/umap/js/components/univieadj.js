function startObservation() {
	const config = {attributes: false, childList: true, subtree: true};

	const callback = () => {
		if (checkIfFullyLoaded()) {
			if (Object.entries(TitleArray).length === 0) {
				buildFeatureNameArray();
			}
			if (target.length > 0 && TitleArray[target] !== undefined) {
				showFeature();
			}
			startup_observer.disconnect();
			observeFeaturesWindow();
			observeMarkers();
		}
	};

	const startup_observer = new MutationObserver(callback);
	try {
		startup_observer.observe(document.getElementById("map"), config);
	} catch (error) {
		// Falls es kein "map" Element gibt, befinden wir uns auf der Startseite wo nur ein Teil der Funktionalität zur Verfügung steht
		observeMarkers();
	}
}

function checkIfFullyLoaded() {
	if(this.U.MAP.dataloaded) {
		let datalayers = this.U.MAP.datalayers_index;
		for(let layer of datalayers) {
			if(!layer._dataloaded) {
				return false;
			}
		}
		return true;
	}
	return false;
}

function buildFeatureNameArray() {
	try {
		let datalayers = this.U.MAP.datalayers_index;
		let featureList = {};

		for(let layer of datalayers) {
			Object.assign(featureList, layer._features);
		}

		/*
		let mymap = new Map(featurelist.map(x => [x[1].id,x[0]]));
		mymap.get('Q3NTI');
		*/

		for (let feature of Object.entries(featureList)) {
			TitleArray[feature[1].id] = feature[1].properties.name;
		}
	} catch (error) {
		//console.log("Build Feature Name Array Error: " + error);
	}
}

function showFeature() {
	try {
		let feature = U.MAP.getFeatureById(target);
		feature.zoomTo();
		feature.view();
	} catch (e) {
		//console.log("Show Feature Error: " + e);
	}
}

function observeFeaturesWindow() {
	const config = { attributes: false, childList: true, subtree: true };
	const callback = () => {
		adjustSearchFieldEvents();
	};

	const browser_observer = new MutationObserver(callback);

	try {
		browser_observer.observe(document.querySelector("[class*=' on']"), config);
		adjustSearchFieldEvents();
	} catch (error) {
		//console.log("Cannot observe databrowser. Error: " + error);
	}
}

function observeMarkers() {
	const config = { attributes: false, childList: true, subtree: true };
	const callback = (mutationList) => {
		for(let mutation of mutationList)  {
			if(mutation.addedNodes.length > 0 && mutation.addedNodes.item(0).nodeType === 1) {
				makeMarkersAccessible();
				break;
			}
		}
	};

	const browser_observer = new MutationObserver(callback);

	try {
		browser_observer.observe(document.querySelector("[class*='leaflet-marker-pane']"), config);
		makeMarkersAccessible();
	} catch (error) {
		//console.log("Cannot observe marker pane. Error: " + error);
	}
}

function adjustSearchFieldEvents() {
	let inputField = document.querySelector('input[name="filter"]');
	let inputFieldEntries = Object.entries(inputField);
	for(let handler of inputFieldEntries) {
		if (handler[0].includes("_leaflet_events")) {
			if(Object.entries(handler[1]).length>=3) {
				return null;
			}
		}
	}

	L.DomEvent.on(document.querySelector('input[name="filter"]'),
		'keyup',
		function (event) {
			if (event.key === "Enter") {
				if (U.MAP.getLayersBounds().isValid()) {
					U.MAP.fitBounds(U.MAP.getLayersBounds(), 'zoomTo');
				}
				openFilledGroups();
			}
		}, this);
}

function openFilledGroups(){
	let groups = document.querySelectorAll("[class*=datalayer-counter]");
	for(let group of groups) {
		let entriesfound = group.firstChild.data;
		let slashpos = entriesfound.lastIndexOf("/");
		if (slashpos === -1) {
			entriesfound = entriesfound.substring(1,entriesfound.length-1);
		} else {
			entriesfound = entriesfound.substring(1,slashpos);
		}
		let currentclass = group.parentElement.parentElement.getAttribute("class");
		// css class show-list controls if group is open or not
		if (entriesfound > 0) {
			setClass(group.parentElement.parentElement, currentclass+ " show-list");
		} else {
			setClass(group.parentElement.parentElement, currentclass.replace(" show-list", ""));
		}
	}
}

function makeMarkersAccessible() {
	let elementlist = document.getElementsByClassName("leaflet-marker-icon");
	for(let element of elementlist) {
		addMarkerTitle(element);
		//img for Marker is currently two levels down from leaflet-interactive
		if(element.children.length > 1){
			setAltText(element.firstChild.firstChild,"marker");
		}
	}
}

function addMarkerTitle(element) {
	// dataset.feature contains the geojson id for the POI
	let title = findMarkerTitle(element.dataset.feature);
	setTitle(element,title);
}

function findMarkerTitle(id) {
	if (Object.entries(TitleArray).length > 0) {
		return TitleArray[id];
	} else {
		return "marker";
	}
}

function setAltText(element, text) {
	element.setAttribute("alt",text);
}

function setClass(element, text) {
	element.setAttribute("class", text);
}

function setTitle(element, text) {
	element.setAttribute("title", text);
}

let TitleArray = [];
let urlParams = new URLSearchParams(window.location.search);
let target = "";
if (urlParams.has('feature')) {
	target = urlParams.get('feature');
}

document.addEventListener( "load", startupAdjustments());
  function startupAdjustments() {
	  try {
		let langDropDown = document.getElementsByName("language")[0];
		setTitle(langDropDown, "language");
	  } catch (error){
		  //console.log("No Language Drop Down exists: " + error);
	  }
	  startObservation();
  }





