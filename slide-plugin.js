var SpurEvents = require('spur-events');
var addListener = SpurEvents.addListener;
var removeListener = SpurEvents.removeListener;

var interactionLock = require('spur-interaction-lock');

var SLIDE_THRESHOLD = 8;

function didSwipe(slideDelta, timeDelta) {
	var distance = Math.abs(slideDelta);
	return distance > 10 && distance / timeDelta > 0.65;
}

function getAxisCoordinate(e, axis) {
	if (axis === 'x') {
		return e.clientX;
	}

	return e.clientY;
}

function SlidePlugin(component) {
	this.component = component;
	this.enable = true;
	this.axis = null;
}

SlidePlugin.plugName = 'slide';

SlidePlugin.prototype.slideStart = function (e, boundingBox) {
	if (this.component.onSlideStart) { this.component.onSlideStart(e, boundingBox); }
	if (this.component.props.onSlideStart) { this.component.props.onSlideStart(this.component, e, boundingBox); }
};

SlidePlugin.prototype.sliding = function (e) {
	if (this.component.onSlide) { this.component.onSlide(e); }
	if (this.component.props.onSlide) { this.component.props.onSlide(this.component, e); }
};

SlidePlugin.prototype.slideEnd = function (e, startCoords, swiped) {
	if (this.component.onSlideEnd) { this.component.onSlideEnd(e, startCoords, swiped); }
	if (this.component.props.onSlideEnd) { this.component.props.onSlideEnd(this.component, e, startCoords, swiped); }
};

SlidePlugin.prototype.setEnable = function (enable) {
	this.enable = enable;
};

SlidePlugin.prototype.setAxis = function (axis) {
	this.axis = axis;
};

SlidePlugin.prototype.reset = function () {
	removeListener(window, 'pointermove', this.onPointerMove, { context: this });
	removeListener(window, 'pointerup', this.onPointerUp, { context: this });
	removeListener(window, 'pointercancel', this.onPointerCancel, { context: this });
	if (this.lockId) { interactionLock.releaseLock(this.lockId); }
	this.isInitiated = false;
	this.target = null;
};

SlidePlugin.prototype.cancel = function (e) {
	if (this.isSliding) {
		this.isSliding = false;
		this.slideEnd(e, this.startCoords, false);
	}
	this.reset();
};

SlidePlugin.prototype.onPointerMove = function (e) {
	if (!this.isSliding) {
		var deltaX = e.clientX - this.startCoords.x;
		var deltaY = e.clientY - this.startCoords.y;
		var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		if (distance < SLIDE_THRESHOLD) {
			return;
		}

		this.lockId = interactionLock.requestLockOn(this.target);
		if (!this.lockId) { return this.reset(); }

		if (Math.abs(deltaY) > Math.abs(deltaX)) {
			if (!this.axis || this.axis === 'y') {
				this.isSliding = true;
				this.slideStart(e, this.boundingBox);
			} else {
				this.reset();
			}
			return;
		}

		if (!this.axis || this.axis === 'x') {
			this.isSliding = true;
			this.slideStart(e, this.boundingBox);
		} else {
			this.reset();
		}
	}

	e.preventDefault();
	this.sliding(e);
};

SlidePlugin.prototype.onPointerDown = function (e) {
	if (
		!this.enable ||
		this.isInitiated ||
		(e.pointerType === 'mouse' && e.buttons !== 1)) {
		return;
	}
	this.isInitiated = true;
	this.isSliding = false;
	this.startTime = Date.now();
	this.target = e.target;

	this.startCoords = {
		x: e.clientX,
		y: e.clientY
	};

	this.boundingBox = this.DOMNode.getBoundingClientRect();
	addListener(window, 'pointermove', this.onPointerMove, { context: this });
	addListener(window, 'pointercancel', this.cancel, { context: this });
	addListener(window, 'pointerup', this.onPointerUp, { context: this });
};

SlidePlugin.prototype.onPointerUp = function (e) {
	if (this.isSliding) {
		var timeDelta = Date.now() - this.startTime;
		var swipe;
		if (this.axis) {
			swipe = didSwipe(getAxisCoordinate(e, this.axis) - this.startCoords[this.axis], timeDelta);
		} else {
			swipe =
				didSwipe(e.clientX - this.startCoords.x, timeDelta) && 'x' ||
				didSwipe(e.clientY - this.startCoords.y, timeDelta) && 'y';
		}

		e.preventDefault();
		this.slideEnd(e, this.startCoords, swipe);
	}

	this.isSliding = false;
	this.reset();
};

SlidePlugin.prototype.componentDidMount = function (DOMNode) {
	this.DOMNode = DOMNode;
	addListener(this.DOMNode, 'pointerdown', this.onPointerDown, { context: this });
};

SlidePlugin.prototype.componentWillUnmount = function () {
	removeListener(this.DOMNode, 'pointerdown', this.onPointerDown, { context: this });
	this.reset();
	this.DOMNode = null;
	this.component = null;
};

module.exports = SlidePlugin;
