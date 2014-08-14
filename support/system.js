
/** @typedef {number} _tGUID */

function _cClassData() {

	/**
	 * Short name of the class (without namespace)
	 * @type {string}
	 */
	this.name = '';

	/**
	 * Long name (including namespace)
	 * @type {string}
	 */
	this.path = '';

	/**
	 * The raw class object, from which it was constructed
	 * @type {Object}
	 */
	this.source_object = {};

	/**
	 * How many parents does it have (via Extends directive)
	 * @type {number}
	 */
	this.hierarchy_index = 0;

	/**
	 * When Extends is present - a string with full name of the parent
	 * @type {string}
	 */
	this.extends = null;

	/** @type {Array.<string>} */
	this.implements = [];

	/**
	 * Class data of parent
	 * @type {_cClassData}
	 */
	this.parent_class_data = null;

	/**
	 * List of full paths to classes in the hierarchy, with this one being the last.
	 * @type {Array.<string>}
	 */
	this.hierarchy_paths = [];

	/**
	 * Used to build the class constructor.
	 * @type {Object}
	 */
	this.skeleton = {};

	/**
	 * For each function (and sometimes array) reference in skeleton - holds the actual data
	 * @type {Array}
	 */
	this.references = [];

	/**
	 * Holds shared objects
	 * @type {Object}
	 */
	this.shared = {};

	/**
	 * Temporary counter for class serialization
	 * @type {number}
	 */
	this.own_references_count = 0;
}

function _iEventTicket() {

	this.remove = function() {};

}

function _cEnumerableEventArgs() {

	this.uids = [];
	this.values = [];
	this.names = [];

}

function _cTranslatableString() {

	this.type = 'translate';
	this.value = '';
	this.description = '';
	this.context = '';

}

function _cTranslatablePlural() {

	this.type = 'ntranslate';
	/** @type {Array.<string>} */
	this.value = [];
	this.description = '';
	this.context = '';

}

function _cScopeForeach() {

	this.create_own_enumerable = false;
	/**
	 * @type {?string}
	 */
	this.after_refresh_callback = null;

}

/** @typedef {function(x)} _tTransitionCallback */

/**
 * Animation transition function
 * @callback _tTransitionCallback
 * @param {number} x The current animation position, 0 <= x <= 1
 */