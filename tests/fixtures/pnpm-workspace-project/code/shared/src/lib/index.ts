
/** Api */
export { type InitParam } from 'openapi-fetch';
export * from './api/client.js';
export {
	RequestState,
	type DeleteMethodPaths,
	type GetMethodPaths,
	type MaybeOptionalInit,
	type RequestStateOptions
} from './api/requestState.svelte.js';
// export { type paths } from './api/schema.js';
export * from './api/zod/index.js';

// Tourno API schema types
export type { paths as TournoManagementPaths } from './api/tourno-management-schema.js';
export type { paths as TournoMobilePaths } from './api/tourno-mobile-schema.js';
export type { paths as TournoPublicPaths } from './api/tourno-public-schema.js';

// Tourno API Clients (split by audience)
export {
	createTournoManagementClient,
	errorLoggingMiddleware,
	authMiddleware as tournoManagementAuthMiddleware,
	type TournoManagementApiClient
} from './api/tourno-management-client.js';
export {
	createAppUserAuthMiddleware,
	createTournoMobileClient,
	authMiddleware as tournoMobileAuthMiddleware,
	type TournoMobileApiClient
} from './api/tourno-mobile-client.js';
export { createTournoPublicClient, type TournoPublicApiClient } from './api/tourno-public-client.js';

/** Actions */
export * from './actions/index.js';

export * from './features/index.js';
export * from './models/index.js';

export * from './data/index.js';

export { updateLoggerMetaData } from './logger/createLogger.js';
export * from './logger/errorHandler.js';

/** Components
 *  These have to be exported the long way because of the way Svelte components are exported
 */

export * from './components/index.js';
export * from './components/core';

//Tabs
export { default as Tab } from './components/tabs/Tab.svelte';
export { default as TabButtons } from './components/tabs/TabButtons.svelte';
export type { TabContext } from './components/tabs/tabs.js';
export { default as Tabs } from './components/tabs/Tabs.svelte';

//Form
export { default as DirtyNavigation } from './components/form/DirtyNavigation.svelte';
export { default as EditForm } from './components/form/EditForm.svelte';
export { formDirtyStore } from './components/form/FormDirtyStore.svelte';
export { useZodForm } from './components/form/zodForm.js';
export { default as ZodForm } from './components/form/ZodForm.svelte';

export { default as Checkbox } from './components/form/inputs/Checkbox.svelte';
export { default as InputNumber } from './components/form/inputs/InputNumber.svelte';
export { default as InputText } from './components/form/inputs/InputText.svelte';
export { default as InputTextArea } from './components/form/inputs/InputTextArea.svelte';
export { default as Select } from './components/form/inputs/Select.svelte';

export { default as CheckboxField } from './components/form/fields/CheckboxField.svelte';
export { default as ColorPickerField } from './components/form/fields/ColorPickerField.svelte';
export { default as NumberField } from './components/form/fields/NumberField.svelte';
export { default as RichTextField } from './components/form/fields/RichTextField.svelte';
export { default as SelectField } from './components/form/fields/SelectField.svelte';
export { default as TextField } from './components/form/fields/TextField.svelte';
export { default as RichTextView } from './components/form/RichTextView.svelte';

export { default as Carousel } from './components/carousel/Carousel.svelte';
export { default as Slider } from './components/carousel/Slider.svelte';

//Tooltip
export { default as Tooltip } from './components/tooltip/Tooltip.svelte';

// Modal
export { default as ConfirmModal } from './components/modal/ConfirmModal.svelte';
export { default as Modal } from './components/modal/Modal.svelte';
export { default as Modal2 } from './components/modal/Modal2.svelte';
export { default as ModalContent } from './components/modal/ModalContent.svelte';

export { default as AddItemHeader } from './components/headers/AddItemHeader.svelte';
export { default as Header } from './components/headers/Header.svelte';

// Table
// export { default as Table } from './components/table/Table.svelte';

//Icons
export { default as Icon } from '@iconify/svelte';
export { default as BackIcon } from './components/icons/BackIcon.svelte';
export { default as ChevronDown } from './components/icons/ChevronDown.svelte';
export { default as DefaultMedia } from './components/icons/DefaultMedia.svelte';
export { type IconProps } from './components/icons/icons.js';
export { default as LeftIcon } from './components/icons/LeftIcon.svelte';

//Toast
export { default as DeleteAlert } from './components/alerts/DeleteAlert.svelte';
export { default as Badge } from './components/badge/Badge.svelte';
// export { toast, default as Toaster } from './components/toast/Toaster.svelte';

/** Events */
export * from './events/clickOutside.js';

/** Actions */
export * from './actions/index.js';

/** Data */
export { defaultIcons } from './data/DefaultIcons.js';

/** Assets */
export * from '../images/index.js';

/** Utils */
export * from './utils/deviceStorage.js';
export * from './utils/index.js';

/** Strings */
export * from './utils/strings.js';

/** Stores */
export * from './stores/index.js';

/** Dates */
export * from './utils/dates.js';

/** Page */
export * from './utils/page.js';

export * from './types/index.js';

/**Dependencies  */
export {
	add,
	addDays,
	format,
	formatDistance,
	isAfter,
	isBefore,
	isEqual,
	parse,
	parseISO,
	subDays
	// Add any other date-fns functions you need
} from 'date-fns';

export { z } from 'zod';
export { Sortable };

import Sortable from 'sortablejs';