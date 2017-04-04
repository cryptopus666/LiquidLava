/**
 * Create and manage classes
 */
Lava.ClassManager = {

	/**
	 * Whether to serialize them and inline as a value, when building constructor,
	 * or slice() from original array in original object
	 * @type {boolean}
	 */
	inline_simple_arrays: true,
	/**
	 * If an array consists of these types - it can be inlined
	 * @type {Array.<string>}
	 */
	SIMPLE_TYPES: ['string', 'boolean', 'number', 'null', 'undefined'],

	/**
	 * Member type IDs in skeleton
	 * @enum {number}
	 */
	MEMBER_TYPES: {
		FUNCTION: 0,
		PRIMITIVE: 1,
		OBJECT: 2,
		STRING: 3,
		REGEXP: 4,
		EMPTY_ARRAY: 5,
		INLINE_ARRAY: 6,
		SLICE_ARRAY: 7
	},

	/**
	 * All data that belongs to each class: everything that's needed for inheritance and building of a constructor
	 * @type {Object.<string, _cClassData>}
	 */
	_sources: {},
	/**
	 * Constructors for each class
	 * @type {Object.<string, function>}
	 */
	constructors: {},
	/**
	 * Special directives, understandable by ClassManager
	 */
	_reserved_members: ['Extends', 'Implements', 'Class', 'Shared'],

	/**
	 * Namespaces, which can hold class constructors
	 * @type {Object.<string, Object>}
	 */
	_root: {},

	/**
	 * Add a namespace, that can contain class constructors
	 * @param {string} name The name of the namespace
	 * @param {Object} object The namespace object
	 */
	registerRootNamespace: function(name, object) {

		this._root[name] = object;

	},

	/**
	 * Get {@link _cClassData} structure for each class
	 * @param {string} class_path
	 * @returns {_cClassData}
	 */
	getClassData: function(class_path) {

		return this._sources[class_path];

	},

    /**
     * Returns an object with all class structures by their path
     * @returns {Object.<string, _cClassData>}
     */
    getAllClasses: function() {

        return this._sources;

    },

	/**
	 * Create a class
	 * @param {string} class_path Full name of the class
	 * @param {Object} class_body Class body
	 */
	define: function(class_path, class_body) {

		var name,
			class_data,
			parent_data,
			i,
			count,
			shared_names,
			is_array,
			type;

		class_data = /** @type {_cClassData} */ {
			name: class_path.split('.').pop(),
			path: class_path,
            class_body: class_body,
			"extends": null,
			"implements": [],
			parent_class_data: null,
			extends_paths: null,
			extends_names: null,
			skeleton: null,
			references: [],
			shared: {},
			constructor: null,
			own_references_count: 0,
			is_abstract: false
		};

		if ('Class' in class_body) {
			var class_options = class_body.Class;
			if (!class_options) Lava.t("Malformed 'Class' property in " + class_path);
			if (class_options.is_abstract) class_data.is_abstract = true;
		}

		if ('Extends' in class_body) {

			if (Lava.schema.DEBUG && typeof(class_body.Extends) != 'string') Lava.t('[ClassManager] value of Extends directive must be a string. ' + class_path);
			class_data['extends'] = /** @type {string} */ class_body.Extends;
			parent_data = this._sources[class_body.Extends];
			class_data.parent_class_data = parent_data;

			if (Lava.schema.DEBUG) {
				if (!parent_data) Lava.t('[ClassManager] parent class not found: "' + class_body.Extends + '"');
				if (parent_data.extends_names.indexOf(class_data.name) != -1) Lava.t("[ClassManager] duplicate name in inheritance chain: '" + class_data.name + "' in " + class_path);
			}

			class_data.extends_paths = parent_data.extends_paths.slice();
			class_data.extends_paths.push(class_path);
			class_data.extends_names = parent_data.extends_names.slice();
			class_data.extends_names.push(class_data.name);
			class_data.references = parent_data.references.slice();
			class_data.own_references_count -= parent_data.references.length;
			class_data.implements = parent_data.implements.slice();

			for (name in parent_data.shared) {

				is_array = Array.isArray(parent_data.shared[name]);
				class_data.shared[name] = is_array
					? parent_data.shared[name].slice()
					: Firestorm.Object.copy(parent_data.shared[name]);

				if (name in class_body) {

					if (Lava.schema.DEBUG && Array.isArray(class_body[name]) != is_array) Lava.t("[ClassManager] 'Shared' members of different types must not override each other (array must not become an object)");
					if (is_array) {
						class_data.shared[name] = class_body[name];
					} else {
						Firestorm.extend(class_data.shared[name], class_body[name]);
					}

				}

			}

		} else {

			class_data.extends_paths = [class_path];
			class_data.extends_names = [class_data.name];

		}

		if ('Shared' in class_body) {

			shared_names = (typeof(class_body.Shared) == 'string') ? [class_body.Shared] : class_body.Shared;

			for (i = 0, count = shared_names.length; i < count; i++) {

				name = shared_names[i];
				type = Firestorm.getType(class_body[name]);

				if (Lava.schema.DEBUG) {
					if (!(name in class_body)) Lava.t("[ClassManager] 'Shared' member is not in class: " + name);
					if (type != 'object' && type != 'array') Lava.t("[ClassManager] only objects and arrays can be made 'Shared'");
					if (class_data.parent_class_data && (name in class_data.parent_class_data.skeleton)) Lava.t("[ClassManager] instance member from parent class may not become 'Shared' in descendant: " + name);
					if (name in class_data.shared) Lava.t("[ClassManager] member is already 'Shared' in parent class: " + class_path + "#" + name);
				}

				class_data.shared[name] = class_body[name];

			}

		}

		class_data.skeleton = this._disassemble(class_data, class_body, true);

		if (parent_data) {

			this._extend(class_data, class_data.skeleton, parent_data, parent_data.skeleton, true);

		}

		class_data.own_references_count += class_data.references.length;

		if ('Implements' in class_body) {

			if (typeof(class_body.Implements) == 'string') {

				this._implementPath(class_data, class_body.Implements);

			} else {

				for (i = 0, count = class_body.Implements.length; i < count; i++) {

					this._implementPath(class_data, class_body.Implements[i]);

				}

			}

		}

        if (Lava.schema.DEBUG) {
            for (name in class_data.shared) {
                if (name in class_data.skeleton) Lava.t("[ClassManager] 'Shared' class member is hidden by member from instance: " + class_data.path + "::" + name);
            }
        }

        if (class_data.is_abstract) {

			class_data.constructor = function() {
				Lava.t("Trying to create an instance of an abstract class: " + class_data.path);
			};
			class_data.constructor.prototype.Class = class_data;

		} else {

			class_data.constructor = this._buildRealConstructor(class_data);

		}

		this._registerClass(class_data);

	},

	/**
	 * Implement members from another class into current class data
	 * @param {_cClassData} class_data
	 * @param {string} path
	 */
	_implementPath: function(class_data, path) {

		var implements_source = this._sources[path],
			name,
			references_offset;

		if (Lava.schema.DEBUG) {

			if (!implements_source) Lava.t('[ClassManager] Implements: class not found - "' + path + '"');
			for (name in implements_source.shared) Lava.t("[ClassManager] Implements: classes with 'Shared' can not be used as mixin. " + class_data.path + " <- " + path);
			if (class_data.implements.indexOf(path) != -1) Lava.t("[ClassManager] Implements: class " + class_data.path + " already implements " + path);
			if (implements_source.skeleton._afterInit) Lava.t("[ClassManager] Implements: Classes with `_afterInit` hook can not be used as mixin: " + class_data.path + " <- " + path);

		}

		class_data.implements.push(path);
		references_offset = class_data.references.length;
		// array copy is inexpensive, cause it contains only reference types
		class_data.references = class_data.references.concat(implements_source.references);

		this._extend(class_data, class_data.skeleton, implements_source, implements_source.skeleton, true, references_offset);

	},

	/**
	 * Perform extend/implement operation
	 * @param {_cClassData} child_data
	 * @param {Object} child_skeleton The skeleton of a child object
	 * @param {_cClassData} parent_data
	 * @param {Object} parent_skeleton The skeleton of a parent object
	 * @param {boolean} is_root <kw>true</kw>, when extending skeletons class bodies, and <kw>false</kw> in all other cases
	 * @param {number} [references_offset] Also acts as a sign of 'implements' mode
	 */
	_extend: function(child_data, child_skeleton, parent_data, parent_skeleton, is_root, references_offset) {

		var parent_descriptor,
			name,
			new_name,
			parent_type;

		for (name in parent_skeleton) {

			parent_descriptor = parent_skeleton[name];
			parent_type = parent_descriptor.type;

			if (name in child_skeleton) {

				if (is_root && (child_skeleton[name].type == this.MEMBER_TYPES.FUNCTION ^ parent_type == this.MEMBER_TYPES.FUNCTION)) {
					// Allow null properties from parent to become class methods in child
					if (
						child_skeleton[name].type != this.MEMBER_TYPES.FUNCTION
						|| parent_type != this.MEMBER_TYPES.PRIMITIVE
						|| parent_descriptor.value != null
					) {
						Lava.t('[ClassManager] Extend: a method from parent must not become something else in child: ' + child_data.path + "::" + name);
					}
				}

				if (parent_type == this.MEMBER_TYPES.FUNCTION) {

					if (!is_root || typeof(references_offset) != 'undefined') continue;

					new_name = parent_data.name + '$' + name;
					if (new_name in child_skeleton) Lava.t('[ClassManager] conflict, function already exists in child: ' + new_name);
					child_skeleton[new_name] = parent_descriptor;

				} else if (parent_type == this.MEMBER_TYPES.OBJECT) {

					this._extend(child_data, child_skeleton[name].skeleton, parent_data, parent_descriptor.skeleton, false, references_offset);

				}

			} else if (parent_type == this.MEMBER_TYPES.OBJECT) {

				child_skeleton[name] = {type: this.MEMBER_TYPES.OBJECT, skeleton: {}};
				this._extend(child_data, child_skeleton[name].skeleton, parent_data, parent_descriptor.skeleton, false, references_offset);

			} else if (
				references_offset &&
				(
					parent_type == this.MEMBER_TYPES.FUNCTION
					|| parent_type == this.MEMBER_TYPES.SLICE_ARRAY
					|| parent_type == this.MEMBER_TYPES.REGEXP
				)
			) {

				child_skeleton[name] = {type: parent_type, index: parent_descriptor.index + references_offset};

			} else {

				child_skeleton[name] = parent_descriptor;

			}

		}

	},

	/**
	 * Recursively create skeletons for all objects inside class body
	 * @param {_cClassData} class_data
	 * @param {Object} class_body
	 * @param {boolean} is_root
	 * @returns {Object}
	 */
	_disassemble: function(class_data, class_body, is_root) {

		var name,
			skeleton = {},
			value,
			type,
			skeleton_value;

		for (name in class_body) {

			if (is_root && (this._reserved_members.indexOf(name) != -1 || (name in class_data.shared))) {

				continue;

			}

			value = class_body[name];
			type = Firestorm.getType(value);

			switch (type) {
				case 'null':
				case 'boolean':
				case 'number':
					skeleton_value = {type: this.MEMBER_TYPES.PRIMITIVE, value: value};
					break;
				case 'string':
					skeleton_value = {type: this.MEMBER_TYPES.STRING, value: value};
					break;
				case 'function':
					skeleton_value = {type: this.MEMBER_TYPES.FUNCTION, index: class_data.references.length};
					class_data.references.push(value);
					break;
				case 'regexp':
					skeleton_value = {type: this.MEMBER_TYPES.REGEXP, index: class_data.references.length};
					class_data.references.push(value);
					break;
				case 'object':
					skeleton_value = {
						type: this.MEMBER_TYPES.OBJECT,
						skeleton: this._disassemble(class_data, value, false)
					};
					break;
				case 'array':
					if (value.length == 0) {
						skeleton_value = {type: this.MEMBER_TYPES.EMPTY_ARRAY};
					} else if (this.inline_simple_arrays && this.isInlineArray(value)) {
						skeleton_value = {type: this.MEMBER_TYPES.INLINE_ARRAY, value: value};
					} else {
						skeleton_value = {type: this.MEMBER_TYPES.SLICE_ARRAY, index: class_data.references.length};
						class_data.references.push(value);
					}
					break;
				case 'undefined':
					Lava.t("[ClassManager] Forced code style restriction: please, replace undefined member values with null. Member name: " + name);
					break;
				default:
					Lava.t("[ClassManager] Unsupported property type in source object: " + type);
					break;
			}

			skeleton[name] = skeleton_value;

		}

		return skeleton;

	},

	/**
	 * Build class constructor that can be used with the <kw>new</kw> keyword
	 * @param {_cClassData} class_data
	 * @returns {function} The class constructor
	 */
	_buildRealConstructor: function(class_data) {

		var prototype = {},
			skeleton = class_data.skeleton,
			serialized_value,
			constructor_actions = [],
			name,
			source,
			constructor,
			object_properties,
			uses_references = false;

		for (name in skeleton) {

			switch (skeleton[name].type) {
				case this.MEMBER_TYPES.STRING:
                    serialized_value = Firestorm.String.quote(skeleton[name].value);
					break;
				case this.MEMBER_TYPES.PRIMITIVE: // null, boolean, number
                    serialized_value = skeleton[name].value + '';
					break;
				case this.MEMBER_TYPES.EMPTY_ARRAY:
					serialized_value = "[]";
					break;
				case this.MEMBER_TYPES.INLINE_ARRAY:
					serialized_value = this._serializeInlineArray(skeleton[name].value);
					break;
				case this.MEMBER_TYPES.REGEXP:
				case this.MEMBER_TYPES.FUNCTION:
					prototype[name] = class_data.references[skeleton[name].index];
					break;
				case this.MEMBER_TYPES.SLICE_ARRAY:
					serialized_value = 'r[' + skeleton[name].index + '].slice()';
					uses_references = true;
					break;
				case this.MEMBER_TYPES.OBJECT:
					object_properties = [];
					if (this._serializeSkeleton(skeleton[name].skeleton, class_data, "\t", object_properties)) {
						uses_references = true;
					}
					serialized_value = object_properties.length
						? "{\n\t" + object_properties.join(",\n\t") + "\n}"
						: "{}";
					break;
				default:
					Lava.t("[ClassManager] assertion failed - unknown property descriptor type: " + skeleton[name].type);
			}

			if (serialized_value) {

				if (Lava.VALID_PROPERTY_NAME_REGEX.test(name)) {

					constructor_actions.push('this.' + name + ' = ' + serialized_value);

				} else {

					constructor_actions.push('this[' + Firestorm.String.quote(name) + '] = ' + serialized_value);

				}

				serialized_value = null;

			}

		}

		for (name in class_data.shared) {

			prototype[name] = class_data.shared[name];

		}

		prototype.Class = class_data;

		if (Lava.schema.DEBUG) {
			source = 'if (!this.Class) Lava.t("Class constructor was called without `new` operator.");'
		}

		source += (uses_references ? ("var r=this.Class.references;\n") : '')
			+ constructor_actions.join(";\n")
			+ ";";

		if (class_data.skeleton.init) {

			source += "\nthis.init.apply(this, arguments);";

		}

		if (class_data.skeleton._afterInit) {

			if (Lava.schema.DEBUG && class_data.skeleton._afterInit.type != this.MEMBER_TYPES.FUNCTION) Lava.t("[ClassManager] _afterInit is not a function. If _afterInit is defined - then it must be a function.");
			source += "\nthis._afterInit();";

		}

		constructor = new Function(source);
		// for Chrome we could assign prototype object directly,
		// but in Firefox this will result in performance degradation
		Firestorm.extend(constructor.prototype, prototype);
		return constructor;

	},

	/**
	 * Perform special class serialization, that takes functions and resources from class data and can be used in constructors
	 * @param {Object} skeleton
	 * @param {_cClassData} class_data
	 * @param {string} padding
	 * @param {Array} serialized_properties
	 * @returns {boolean} <kw>true</kw>, if object uses {@link _cClassData#references}
	 */
	_serializeSkeleton: function(skeleton, class_data, padding, serialized_properties) {

		var name,
			serialized_value,
			uses_references = false,
			object_properties;

		for (name in skeleton) {

			switch (skeleton[name].type) {
				case this.MEMBER_TYPES.STRING:
					serialized_value = Firestorm.String.quote(skeleton[name].value);
					break;
				case this.MEMBER_TYPES.PRIMITIVE: // null, boolean, number
					serialized_value = skeleton[name].value + '';
					break;
				case this.MEMBER_TYPES.REGEXP:
				case this.MEMBER_TYPES.FUNCTION:
					serialized_value = 'r[' + skeleton[name].index + ']';
					uses_references = true;
					break;
				case this.MEMBER_TYPES.EMPTY_ARRAY:
					serialized_value = "[]";
					break;
				case this.MEMBER_TYPES.INLINE_ARRAY:
					serialized_value = this._serializeInlineArray(skeleton[name].value);
					break;
				case this.MEMBER_TYPES.SLICE_ARRAY:
					serialized_value = 'r[' + skeleton[name].index + '].slice()';
					uses_references = true;
					break;
				case this.MEMBER_TYPES.OBJECT:
					object_properties = [];
					if (this._serializeSkeleton(skeleton[name].skeleton, class_data, padding + "\t", object_properties)) {
						uses_references = true;
					}
					serialized_value = object_properties.length
						? "{\n\t" + padding + object_properties.join(",\n\t" + padding) + "\n" + padding + "}" : "{}";
					break;
				default:
					Lava.t("[ClassManager] assertion failed - unknown property descriptor type: " + skeleton[name].type);
			}

			if (Lava.VALID_PROPERTY_NAME_REGEX.test(name) && Lava.JS_KEYWORDS.indexOf(name) == -1) {

				serialized_properties.push(name + ': ' + serialized_value);

			} else {

				serialized_properties.push(Firestorm.String.quote(name) + ': ' + serialized_value);

			}

		}

		return uses_references;

	},

	/**
	 * Get namespace for a class constructor
	 * @param {Array.<string>} path_segments Path to the namespace of a class. Must start with one of registered roots
	 * @returns {Object}
	 */
	_getNamespace: function(path_segments) {

		var namespace,
			segment_name,
			count = path_segments.length,
			i = 1;

		if (!count) Lava.t("[ClassManager] class path must start with a namespace, even for global classes.");
		if (!(path_segments[0] in this._root)) Lava.t("[ClassManager] namespace is not registered: " + path_segments[0]);
		namespace = this._root[path_segments[0]];

		for (; i < count; i++) {

			segment_name = path_segments[i];

			if (!(segment_name in namespace)) {

				namespace[segment_name] = {};

			}

			namespace = namespace[segment_name];
            if (Lava.schema.DEBUG && !namespace) Lava.t("Namespaces must be objects: please make sure, that path " + path_segments.join('.') + " does not contain null or undefined values.");

		}

		return namespace;

	},

	/**
	 * Get class constructor
	 * @param {string} class_path Full name of a class, or a short name (if namespace is provided)
	 * @param {string} [default_namespace] The default prefix where to search for the class, like <str>"Lava.widget"</str>
	 * @returns {function}
	 */
	getConstructor: function(class_path, default_namespace) {

		if (!(class_path in this.constructors) && default_namespace) {

			class_path = default_namespace + '.' + class_path;

		}

		return this.constructors[class_path];

	},

	/**
	 * Whether to inline or slice() an array in constructor
	 * @param {Array} items
	 * @returns {boolean}
	 */
	isInlineArray: function(items) {

		var result = true,
			i = 0,
			count = items.length;

		for (; i < count; i++) {

			if (this.SIMPLE_TYPES.indexOf(Firestorm.getType(items[i])) == -1) {
				result = false;
				break;
			}

		}

		return result;

	},

	/**
	 * Serialize an array which contains only certain primitive types from `SIMPLE_TYPES` property
	 *
	 * @param {Array} data
	 * @returns {string}
	 */
	_serializeInlineArray: function(data) {

		var tempResult = [],
			i = 0,
			count = data.length,
			type,
			value;

		for (; i < count; i++) {

			type = Firestorm.getType(data[i]);
			switch (type) {
				case 'string':
					value = Firestorm.String.quote(data[i]);
					break;
				case 'null':
				case 'undefined':
				case 'boolean':
				case 'number':
					value = data[i] + '';
					break;
				default:
					Lava.t();
			}
			tempResult.push(value);

		}

		return '[' + tempResult.join(", ") + ']';

	},

	/**
	 * Register an existing function as a class constructor for usage with {@link Lava.ClassManager#getConstructor}()
	 * @param {string} class_path Full class path
	 * @param {function} constructor Constructor instance
	 */
	registerExistingConstructor: function(class_path, constructor) {

		if (class_path in this._sources) Lava.t('Class "' + class_path + '" is already defined');
		this.constructors[class_path] = constructor;

	},

	/**
	 * Does a constructor exists
	 * @param {string} class_path Full class path
	 * @returns {boolean}
	 */
	hasConstructor: function(class_path) {

		return class_path in this.constructors;

	},

	/**
	 * Does a class exists
	 * @param {string} class_path
	 * @returns {boolean}
	 */
	hasClass: function(class_path) {

		return class_path in this._sources;

	},

	/**
	 * Put a newly built class constructor into it's namespace
	 * @param {_cClassData} class_data
	 */
	_registerClass: function(class_data) {

		var class_path = class_data.path,
			namespace_path,
			class_name,
			namespace;

		if ((class_path in this._sources) || (class_path in this.constructors)) Lava.t("Class is already defined: " + class_path);
		this._sources[class_path] = class_data;

		if (class_data.constructor) {

			namespace_path = class_path.split('.');
			class_name = namespace_path.pop();
			namespace = this._getNamespace(namespace_path);

			if ((class_name in namespace) && namespace[class_name] != null) Lava.t("Class name conflict: '" + class_path + "' is already defined in it's namespace");

			this.constructors[class_path] = class_data.constructor;
			namespace[class_name] = class_data.constructor;

		}

	},

	/**
	 * Find a class that begins with `base_path` or names of it's parents, and ends with `suffix`
	 * @param {string} base_path
	 * @param {string} suffix
	 * @returns {function}
	 */
	getPackageConstructor: function(base_path, suffix) {

		if (Lava.schema.DEBUG && !(base_path in this._sources)) Lava.t("[ClassManager] getPackageConstructor - class not found: " + base_path);

		var path,
			current_class = this._sources[base_path],
			result = null;

		do {

			path = current_class.path + suffix;
			if (path in this.constructors) {

				result = this.constructors[path];
				break;

			}

			current_class = current_class.parent_class_data;

		} while (current_class);

		return result;

	},

	/**
	 * Get all names (full paths) of registered classes
	 * @returns {Array.<string>}
	 */
	getClassNames: function() {

		return Object.keys(this._sources);

	},

	/**
	 * Replace function in a class with new body. Class may be in middle of inheritance chain.
	 * Also replaces old method with <kw>null</kw>.
	 *
	 * @param {Object} instance Current class instance, must be <kw>this</kw>
	 * @param {string} instance_class_name Short name of current class
	 * @param {string} function_name Function to replace
	 * @param {string} new_function_name Name of new method from the prototype
	 * @returns {string} name of the method that was replaced
	 */
	patch: function(instance, instance_class_name, function_name, new_function_name) {

		var cd = instance.Class,
			proto = cd.constructor.prototype,
			names = cd.extends_names,
			i = names.indexOf(instance_class_name),
			count = names.length,
			overridden_name;

		if (Lava.schema.DEBUG && i == -1) Lava.t();

		// find method that belongs to this class body
		for (; i < count; i++) {
			overridden_name = names[i] + "$" + function_name;
			// must not use "in" operator, as function body can be removed and assigned null (see below)
			if (proto[overridden_name]) {
				function_name = overridden_name;
				break;
			}
		}

		proto[function_name] = proto[new_function_name];
		// this plays role when class replaces it's method with parent's method (removes it's own method)
		// and parent also wants to apply patches to the same method (see comment above about the "in" operator)
		proto[new_function_name] = null;
		return function_name;

	}

};