
Lava.define(
'Lava.data.Record',
/**
 * Standard module record
 *
 * @lends Lava.data.Record#
 * @extends Lava.mixin.Properties
 */
{

	Implements: 'Lava.mixin.Properties',
	/**
	 * To tell other classes that this is instance of Record
	 * @type {boolean}
	 * @readonly
	 */
	isRecord: true,
	/**
	 * Record's `_properties` are assigned in constructor, so here we replace the default value (empty object)
	 * to save some time on garbage collection
	 * @type {Object}
	 */
	_properties: null,
	/**
	 * Record's module
	 * @type {Lava.data.ModuleAbstract}
	 */
	_module: null,
	/**
	 * Reference to module's fields
	 * @type {Object.<string, Lava.data.field.Abstract>}
	 */
	_fields: null,
	/**
	 * Global unique identifier
	 * @type {_tGUID}
	 */
	guid: null,

	/**
	 * Create record instance
	 * @param {Lava.data.ModuleAbstract} module Records module
	 * @param {Object.<string, Lava.data.field.Abstract>} fields Object with module's fields
	 * @param {Object} properties_ref Reference to an object with record's properties
	 * @param {Object} raw_properties Object with record field values from server
	 */
	init: function(module, fields, properties_ref, raw_properties) {

		this.guid = Lava.guid++;
		this._module = module;
		this._fields = fields;
		this._properties = properties_ref;

		var field_name;

		if (typeof(raw_properties) != 'undefined') {

			for (field_name in fields) {

				fields[field_name]['import'](this, properties_ref, raw_properties);

			}

		} else {

			for (field_name in fields) {

				fields[field_name].initNewRecord(this, properties_ref);

			}

		}

	},

	get: function(name) {

		if (Lava.schema.DEBUG && !(name in this._fields)) Lava.t('[Record] No such field: ' + name);
		return this._fields[name].getValue(this, this._properties);

	},

	set: function(name, value) {

		if (Lava.schema.DEBUG && !(name in this._fields)) Lava.t('[Record] No such field: ' + name);
		this._fields[name].setValue(this, this._properties, value);

	},

	/**
	 * Get `_module`
	 * @returns {Lava.data.ModuleAbstract}
	 */
	getModule: function() {

		return this._module;

	},

	/**
	 * Export record back into plain JavaScript object for sending to server
	 * @returns {Object}
	 */
	'export': function() {

		var export_record = {};

		for (var field_name in this._fields) {

			this._fields[field_name]['export'](this, export_record);

		}

		return export_record;

	}

});