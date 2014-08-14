
Lava.define(
'Lava.mixin.Refreshable',
/**
 * Auxiliary class for the scope refresh system
 * @lends Lava.mixin.Refreshable#
 * @extends Lava.mixin.Observable
 */
{

	Extends: 'Lava.mixin.Observable',
	/**
	 * Indicates the priority of this scope in the hierarchy. Scopes with lower priority are refreshed first
	 * @type {number}
	 */
	level: 0,
	/**
	 * Force delay of refresh after the last dependency has been updated
	 * @type {boolean}
	 */
	_requeue: false,

	/**
	 * Scopes may depend on other scopes. Scope may refresh itself, when all dependencies are up-to-date
	 * @type {number}
	 */
	_count_dependencies_waiting_refresh: 0,
	/**
	 * Indicates if this scope will participate in the next refresh cycle
	 * @type {boolean}
	 */
	_waits_refresh: false,
	/**
	 * The object, which is given by ScopeManager when the scope is placed into the refresh queue
	 * @type {Object}
	 */
	_refresh_ticket: null,

	/**
	 * Each time the scope is refreshed - it's assigned the id of the current refresh loop
	 * @type {number}
	 */
	_last_refresh_id: 0,
	/**
	 * How many times this scope was refreshed during current refresh loop
	 * @type {number}
	 */
	_refresh_cycle_count: 0,

	/**
	 * Indicates if the scope needs to refresh it's value (dependencies or bindings have changed)
	 * @type {boolean}
	 */
	_is_dirty: false,

	/**
	 * Called by ScopeManager during refresh loop.
	 *
	 * @param {number} refresh_id
	 * @param {boolean} is_safe
	 * @returns {boolean} true in case of infinite loop
	 */
	doRefresh: function(refresh_id, is_safe) {

		if (Lava.schema.DEBUG && this._count_dependencies_waiting_refresh) Lava.t();
		if (Lava.schema.DEBUG && !this._waits_refresh && this._refresh_ticket) Lava.t();

		if (this._waits_refresh) { // to counter exceptions

			// note: the order of the following operations is important
			if (this._last_refresh_id == refresh_id) {

				if (Lava.schema.DEBUG) Lava.logError('Scope was refreshed more than once during one refresh loop');

				this._refresh_cycle_count++;
				if (this._refresh_cycle_count == Lava.schema.REFRESH_INFINITE_LOOP_THRESHOLD && !is_safe) {

					return true; // infinite loop exception

				}

			} else {

				this._last_refresh_id = refresh_id;
				this._refresh_cycle_count = 0;

			}

			this._waits_refresh = false;
			this._refresh_ticket = null;

			if (this._is_dirty) {

				this._is_dirty = false;

				this._doRefresh();

			}

			this._fire('refreshed');

		}

		return false;

	},

	/**
	 * Listens to the waits_refresh event
	 */
	_onDependencyWaitsRefresh: function() {

		this._count_dependencies_waiting_refresh++;

		if (this._waits_refresh) {

			if (this._refresh_ticket) {
				Lava.ScopeManager.cancelScopeRefresh(this._refresh_ticket, this.level);
				this._refresh_ticket = null;
			}

		} else {

			if (Lava.schema.DEBUG && this._refresh_ticket) Lava.t();

			this._waits_refresh = true;
			this._fire('waits_refresh');

		}

	},

	/**
	 * Listens to the refreshed event
	 */
	_onDependencyRefreshed: function() {

		if (Lava.schema.DEBUG && !this._waits_refresh) Lava.t();
		if (Lava.schema.DEBUG && this._refresh_ticket) Lava.t();

		this._count_dependencies_waiting_refresh--;

		if (this._count_dependencies_waiting_refresh == 0) {

			if (this._requeue) {

				if (Lava.schema.DEBUG && this._refresh_ticket) Lava.t();

				this._refresh_ticket = Lava.ScopeManager.scheduleScopeRefresh(this, this.level);

			} else {

				this._waits_refresh = false;

				if (this._is_dirty) {

					this._is_dirty = false;

					this._doRefresh();

				}

				this._fire('refreshed');

			}

		}

	},

	/**
	 * Must be overridden in classes that implement Refreshable to perform the actual refresh logic
	 */
	_doRefresh: function() {

		// may be overridden in inherited classes

	},

	/**
	 * Ensure that this scope will participate in the next refresh cycle
	 */
	_queueForRefresh: function() {

		if (!this._waits_refresh) {

			if (Lava.schema.DEBUG && this._refresh_ticket) Lava.t();

			this._waits_refresh = true;
			this._refresh_ticket = Lava.ScopeManager.scheduleScopeRefresh(this, this.level);
			this._fire('waits_refresh');

		}

	},

	/**
	 * Internal debug assertion, called to verify that the scope does not need to be refreshed
	 */
	debugAssertClean: function() {

		if (this._waits_refresh || this._refresh_ticket || this._is_dirty) Lava.t("Refreshable::debugAssertClean() failed");

	},

	/**
	 * Get `_waits_refresh`
	 * @returns {boolean}
	 */
	isWaitingRefresh: function() {

		return this._waits_refresh;

	},

	/**
	 * Cancel the current refresh ticket and ignore next refresh cycle. Does not destroy the Refreshable instance.
	 */
	suspendRefreshable: function() {

		if (this._refresh_ticket) {
			Lava.ScopeManager.cancelScopeRefresh(this._refresh_ticket, this.level);
			this._refresh_ticket = null;
		}

		this._waits_refresh = false;
		this._count_dependencies_waiting_refresh = 0;
		this._is_dirty = true;

	}

});