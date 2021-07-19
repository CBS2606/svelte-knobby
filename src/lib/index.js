import Number from './knobs/Number.svelte';
import Range from './knobs/Range.svelte';
import Boolean from './knobs/Boolean.svelte';
import Button from './knobs/Button.svelte';
import Folder from './knobs/Folder.svelte';
import String from './knobs/String.svelte';
import Color from './knobs/Color.svelte';
import Knobby from './Knobby.svelte';
import { writable } from 'svelte/store';
import { extract, merge } from './utils';

/** @typedef {import('./types').Node} Node */

/** @param {any} input */
function is_numeric(input) {
	if (typeof input.value !== 'number') return false;

	for (const key in input) {
		if (key.startsWith('$')) continue;

		if (key === 'min' || key === 'max' || key === 'step') {
			const value = input[key];
			if (value && typeof value !== 'function' && typeof value !== 'number') {
				return false;
			}
		} else if (key !== 'value') {
			return false;
		}
	}

	return true;
}

/**
 * @param {any} input
 * @returns {import('./types').Node}
 */
function interpret(input) {
	if (typeof input === 'number') {
		return {
			$component: Number,
			value: input
		};
	}

	if (typeof input === 'boolean') {
		return {
			$component: Boolean,
			value: input
		};
	}

	if (typeof input === 'string') {
		if (/^#[a-fA-F0-9]{6}$/.test(input)) {
			return {
				$component: Color,
				value: input
			};
		}

		return {
			$component: String,
			value: input
		};
	}

	if (typeof input === 'function') {
		return {
			$component: Button,
			value: input
		};
	}

	if (input.$component) return input;

	// try to figure out which component matches
	if (is_numeric(input)) {
		return {
			$component: 'min' in input && 'max' in input ? Range : Number,
			...input
		};
	}

	/** @type {import('./types').Node} */
	const node = {
		$folder: true,
		$component: Folder,
		value: {}
	};

	for (const key in input) {
		if (key.startsWith('$')) {
			node[key] = input[key];
		} else {
			node.value[key] = interpret(input[key]);
		}
	}

	return node;
}

let visible = true;

/** @type {import('svelte').SvelteComponent} */
let controls;

/** @type {Array<import('svelte/store').Writable<any>>} */
const stores = [];

function update() {
	if (typeof document === 'undefined') return;

	if (visible) {
		if (!controls) {
			controls = new Knobby({ target: document.body });
		}

		controls.$set({ stores });
	}
}

/**
 * @param {any} initial
 * @returns {import('svelte/store').Writable<any>}
 */
export function panel(initial) {
	/** @type {import('./types').Node} */
	const node = {
		$folder: true,
		$component: null,
		value: {}
	};

	for (const key in initial) {
		if (key.startsWith('$')) {
			node[key] = initial[key];
		} else {
			node.value[key] = interpret(initial[key]);
		}
	}

	let values = extract(node);

	const private_store = writable(node);

	const public_store = writable(values, (set) => {
		// add to the UI
		// TODO would be good if order was preserved when re-adding later
		stores.push(private_store);
		update();

		private_store.subscribe((node) => {
			if (updating) return;
			set((values = extract(node)));
		});

		return () => {
			const index = stores.indexOf(private_store);
			if (index !== -1) stores.splice(index, 1);
			update();
		};
	});

	let updating = false;

	/** @param {any} values */
	function set(values) {
		// changes to the public store need to be reflected in
		// the private store
		updating = true;
		public_store.set(values);
		private_store.update((node) => merge(node, values));
		updating = false;
	}

	return {
		subscribe: public_store.subscribe,
		update: (fn) => {
			set((values = fn(values)));
		},
		set
	};
}

/** @param {boolean} visibility */
export function toggle(visibility) {
	if (visible === (visible = visibility)) return;

	if (visible) {
		console.log('here');
		update();
	} else if (controls) {
		controls.$destroy();
		controls = null;
	}
}

export { context } from './context.js';
