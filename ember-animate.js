(function () {

	Ember.View.reopen({

		isPrepped : false,
		isAnimating : false,
		cancelAnimation : false,

		currentAnimationClass : "",

		_inCallbacks : [],
		_outCallbacks : [],
		_prepCallbacks : [],

		classNameBindings: ['isAnimating:ember-animate',"currentAnimationClass"],

		animations : {

			animateIn : {
				className : null,
				properties : {
				},
				duration : 0,
				easing : null,
				delay : 0
			},

			animateOut : {
				className : null,
				properties : {},
				duration : 0,
				easing : null,
				delay : 0
			}
		},

		init : function () {

			this._inCallbacks = [];
			this._outCallbacks = [];
			this._prepCallbacks = [];

			this._super();
		},			

		_runCallbacks : function (callbacks, cb) {
			callbacks = callbacks || [];
			while (callbacks.length) {
				cb = callbacks.shift();
				if (typeof cb === "function") {
					cb();
				}
			}
		},

		_runAnimation : function (animation, done) {

			var i,
				self = this;

			if (typeof animation === "string") {
				return this._runAnimation(this.animations[animation], done);
			}

			if (Ember.isArray(animation)) {

				if (isNaN(animation[1])) {
					animation = animation.concat();

					function next () {
						var a = animation.shift();
						return self._runAnimation(a, animation.length ? next : done);
					}

					return next();
				}

				else {
					animation = {
						className : animation[0],
						duration : animation[1],
						easing : null
					}
				}
			}

			if (this.get("cancelAnimation")) {
				if (typeof done === "function") {
					done();
				}
				return;
			}

			Ember.assert('Invalidate animation', animation && typeof animation === "object");

			if (animation.className) {
				this.set("currentAnimationClass", animation.className);
			}

			this.$().css(this._getAnimationCSSObject(animation));


			if (typeof done === "function") {
				if (animation.duration) {
					Ember.run.later(this, function () {
						this.$().css(this._getAnimationCSSObject({duration : "", easing : "", delay : ""}));
						this.set("currentAnimationClass", "");
						done();
					}, animation.duration + (animation.delay || 0));
				}
				else {
					done();
				}
			}
		},

		_vendorPrefix : function () {

			var p,
				r = /^(Moz|Webkit|Khtml|O|ms|Icab)(?=[A-Z])/,
				s = document.getElementsByTagName('script')[0],
				set = Ember.$.proxy(function (p) {
					p = ["", p.toLowerCase(), ""].join("-");
					this._vendorPrefix = function () {
						return p;
					}
					return p;
				}, this);

			for(var prop in s.style) {
				if(r.test(prop)) {
					return set(prop.match(r)[0]);
				}
			}

			if('WebkitOpacity' in s.style) {
				return set('Webkit');
			}

			if('KhtmlOpacity' in s.style) {
				return set('Khtml');
			}

			return set("");
		},

		_getAnimationCSSObject : function (obj) {

			var o = {},
				p,
				props = [],
				prefix = this._vendorPrefix(),
				propertyMap;

			propertyMap = {
				"duration" : "transition-duration",
				"delay" : "transition-delay",
				"easing" : "transition-timing-function"
			};

			if (!obj) {
				return {};
			}

			for (p in (obj.properties || {})) {
				props.push(p);
				o[p] = obj.properties[p];
			}

			if (!props.length) {
				props.push("all");
			}

			if (obj.easing !== null && obj.easing !== "none") {

				o[prefix + "transition-property"] = props.join(",");

				for (p in propertyMap) {
					if (obj[p]) {
						o[prefix + propertyMap[p]] = obj[p] + (p === "duration" || p === "delay" ? "ms" : "");
					}
				}
			}

			return o;
		},

		_prep : function () {
			this.set("isPrepped", false);
			this.prep(Ember.$.proxy(this._prepComplete, this));
		},

		_prepComplete : function () {
			this.set("isPrepped", true);
			this.prepComplete();
			this._runCallbacks(this._prepCallbacks);
		},

		_animateIn : function (cb) {
			if (!this.get("isPrepped")) {
				this._prepCallbacks.push(Ember.$.proxy(function () {
					this._animateIn(cb);
				}, this));
				return;
			}

			this._inCallbacks.push(cb);

			this.set("isAnimating", true);
			this.animateIn(Ember.$.proxy(this._animateInComplete, this));
		},

		_animateInComplete : function () {
			this.set("isAnimating", false);
			this.animateInComplete();
			this._runCallbacks(this._inCallbacks);
		},

		_animateOut : function (cb) {

			if (this.get("isAnimating")) {
				this._inCallbacks.push(Ember.$.proxy(function () {
					this._animateOut(cb);
				}, this));
				this.set("cancelAnimation", true);
				return;
			}

			this.set("cancelAnimation", false);

			this._outCallbacks.push(cb);
			this.set("isAnimating", true);
			this.animateOut(Ember.$.proxy(this._animateOutComplete, this));
		},

		_animateOutComplete : function () {
			this.set("isAnimating", false);
			this.animateOutComplete();
			this.destroy();
			this._runCallbacks(this._outCallbacks);
		},

		didInsertElement : function () {
			Ember.run.schedule('afterRender', this, this._prep);
		},

		prep : function (done) {
			done();
		},

		prepComplete : function () {

		},

		animateIn : function (done) {
			this._runAnimation("animateIn", done);
		},

		animateInComplete : function () {

		},

		animateOut : function (done) {
			this._runAnimation("animateOut", done);
		},

		animateOutComplete : function () {

		}

	});

	Ember.ContainerView.reopen({

		_activeView : null,
		_isAnimatingOut : false,

		_activeViewChanged : function () {

			var view = this.get("_activeView");

			if (view) {
				view._animateIn();
			}

		}.observes("_activeView").on("init"),

		init : function () {
			this._super();

			var currentView = this.get("currentView");

			if (currentView) {
				this.set("_activeView", currentView);
			}
		},	

		_currentViewWillChange : Ember.beforeObserver('currentView', function () {
			//this._oldView = this.get("currentView");
		}),

		_pushNewView : function () {
			var newView = this.get("newView");

			this.pushObject(newView);
			this.set("_activeView", newView);
			this.set("_isAnimatingOut", false);
		},

		_currentViewDidChange : Ember.observer('currentView', function () {

			var activeView = this.get("_activeView");

			this.set("newView", this.get("currentView"));
				
			if (activeView) {
				if (!this.get("_isAnimatingOut")) {
					this.set("_isAnimatingOut", true);
					activeView._animateOut(Ember.$.proxy(this._pushNewView, this));
				}
				return;
			}

			this._pushNewView();	 
		})
	});

})();