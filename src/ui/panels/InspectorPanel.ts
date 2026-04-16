import type { UIControlProperties, BindingEntry, SizeValue, ColorValue } from '../../types/JsonUITypes';
import { ProjectManager } from '../../core/ProjectManager';
import { EventBus } from '../../core/EventBus';
import { el, clearElement, showToast } from '../shared/DomUtils';
import { t, onLangChange } from '../../core/i18n';

/** Property categories for organized display */
type PropertyCategory = 'core' | 'layout' | 'appearance' | 'text' | 'image' | 'button' | 'toggle' | 'slider' | 'grid' | 'scroll' | 'input' | 'binding' | 'animation' | 'screen' | 'custom' | 'variables';

interface PropertyMeta {
  key: string;
  label: string;
  category: PropertyCategory;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'size' | 'json' | 'bindings';
  options?: readonly string[];
  description?: string;
}

const CONTROL_TYPES: readonly string[] = [
  'panel', 'stack_panel', 'collection_panel', 'grid', 'label', 'image', 'button', 'toggle',
  'slider', 'slider_box', 'edit_box', 'dropdown', 'scroll_view', 'scrollbar_track', 'scrollbar_box',
  'factory', 'screen', 'custom', 'selection_wheel', 'input_panel', 'tab', 'carousel_label',
];

const ANCHOR_VALUES: readonly string[] = [
  'top_left', 'top_middle', 'top_right',
  'left_middle', 'center', 'right_middle',
  'bottom_left', 'bottom_middle', 'bottom_right',
];

const ORIENTATIONS: readonly string[] = ['horizontal', 'vertical'];
const FONT_SIZES: readonly string[] = ['small', 'normal', 'large', 'extra_large'];
const FONT_TYPES: readonly string[] = ['default', 'smooth', 'rune', 'MinecraftTen', 'unicode'];
const TEXT_ALIGN: readonly string[] = ['left', 'center', 'right'];
const TEXT_TYPES: readonly string[] = ['ExtendedASCII', 'IdentifierChars', 'NumberChars'];
const CLIP_DIRECTIONS: readonly string[] = ['left', 'right', 'up', 'down', 'center'];
const GRID_RESCALING: readonly string[] = ['none', 'horizontal'];
const GRID_FILL_DIR: readonly string[] = ['none', 'left_to_right', 'right_to_left', 'top_to_bottom', 'bottom_to_top'];
const EASING_TYPES: readonly string[] = [
  'linear', 'spring',
  'in_bounce', 'out_bounce', 'in_out_bounce',
  'in_expo', 'out_expo', 'in_out_expo',
  'in_sine', 'out_sine', 'in_out_sine',
  'in_cubic', 'out_cubic', 'in_out_cubic',
  'in_back', 'out_back', 'in_out_back',
  'in_elastic', 'out_elastic', 'in_out_elastic',
  'in_quart', 'out_quart', 'in_out_quart',
  'in_quint', 'out_quint', 'in_out_quint',
  'in_quad', 'out_quad', 'in_out_quad',
  'in_circ', 'out_circ', 'in_out_circ',
];
const ANIM_TYPES: readonly string[] = ['alpha', 'color', 'size', 'offset', 'uv', 'flip_book', 'wait', 'aseprite_flip_book', 'clip'];

const PROPERTY_DEFINITIONS: readonly PropertyMeta[] = [
  // Core
  { key: 'type',            label: 'Type',           category: 'core', type: 'select',  options: CONTROL_TYPES, description: 'The type of UI element. Determines how it is rendered and behaves.' },
  { key: 'visible',         label: 'Visible',        category: 'core', type: 'boolean', description: 'Whether this element is visible by default.' },
  { key: 'enabled',         label: 'Enabled',        category: 'core', type: 'boolean', description: 'Whether this element is enabled and can be interacted with.' },
  { key: 'layer',           label: 'Layer',          category: 'core', type: 'number',  description: 'Rendering layer. Higher values render on top of lower values.' },
  { key: 'z_order',         label: 'Z Order',        category: 'core', type: 'number',  description: 'Fine-grained depth ordering within the same layer.' },
  { key: 'alpha',           label: 'Alpha',          category: 'core', type: 'number',  description: 'Opacity from 0.0 (transparent) to 1.0 (opaque).' },
  { key: 'propagate_alpha', label: 'Propagate Alpha',category: 'core', type: 'boolean', description: 'Whether alpha transparency propagates to child elements.' },
  { key: 'clips_children',  label: 'Clips Children', category: 'core', type: 'boolean', description: 'Whether child elements are clipped to this element\'s bounds.' },
  { key: 'allow_clipping',  label: 'Allow Clipping', category: 'core', type: 'boolean', description: 'Whether this element can be clipped by parent elements.' },
  { key: 'clip_offset',     label: 'Clip Offset',    category: 'core', type: 'size',    description: 'Offset applied when clipping this element.' },
  { key: 'enable_scissor_test', label: 'Scissor Test', category: 'core', type: 'boolean', description: 'Enable GPU scissor test for clipping.' },
  { key: 'ignored',         label: 'Ignored',        category: 'core', type: 'boolean', description: 'If true, this element is ignored during layout and rendering.' },
  { key: 'selected',        label: 'Selected',       category: 'core', type: 'boolean', description: 'Whether the element is in a selected state.' },
  { key: 'use_child_anchors', label: 'Use Child Anchors', category: 'core', type: 'boolean', description: 'Children use their own anchor points instead of the parent\'s.' },
  { key: 'property_bag',    label: 'Property Bag',   category: 'core', type: 'json',    description: 'Custom key‑value pairs attached to this control for use in bindings.' },

  // Layout
  { key: 'anchor_from',     label: 'Anchor From',    category: 'layout', type: 'select', options: ANCHOR_VALUES, description: 'The anchor point on the parent element from which this element is positioned.' },
  { key: 'anchor_to',       label: 'Anchor To',      category: 'layout', type: 'select', options: ANCHOR_VALUES, description: 'The anchor point on this element used for positioning.' },
  { key: 'size',            label: 'Size',           category: 'layout', type: 'size',   description: 'Size as [width, height]. Supports pixels, "100%", "100%c", "fill", "100% + 4".' },
  { key: 'offset',          label: 'Offset',         category: 'layout', type: 'size',   description: 'Pixel offset from anchor position as [x, y].' },
  { key: 'max_size',        label: 'Max Size',       category: 'layout', type: 'size',   description: 'Maximum size constraints for the element.' },
  { key: 'min_size',        label: 'Min Size',       category: 'layout', type: 'size',   description: 'Minimum size constraints for the element.' },
  { key: 'orientation',     label: 'Orientation',    category: 'layout', type: 'select', options: ORIENTATIONS, description: 'Stack panel direction: children laid out horizontally or vertically.' },
  { key: 'contained',       label: 'Contained',      category: 'layout', type: 'boolean', description: 'Prevents this element from overflowing outside its parent.' },
  { key: 'draggable',       label: 'Draggable',      category: 'layout', type: 'string',  description: 'Makes the element draggable. Values: "vertical", "horizontal", "both".' },
  { key: 'follows_cursor',  label: 'Follows Cursor', category: 'layout', type: 'boolean', description: 'Element follows the mouse/touch cursor position.' },
  { key: 'inherit_max_sibling_width',  label: 'Inherit Max Sibling Width',  category: 'layout', type: 'boolean', description: 'Inherit the width of the widest sibling element.' },
  { key: 'inherit_max_sibling_height', label: 'Inherit Max Sibling Height', category: 'layout', type: 'boolean', description: 'Inherit the height of the tallest sibling element.' },
  { key: 'use_anchored_offset', label: 'Use Anchored Offset', category: 'layout', type: 'boolean', description: 'Offset is applied relative to the anchor rather than the parent origin.' },

  // Text/Label
  { key: 'text',            label: 'Text',           category: 'text', type: 'string',  description: 'Text content for label elements. Supports localization keys and binding names like #player_name.' },
  { key: 'color',           label: 'Color',          category: 'text', type: 'color',   description: 'Text color as [R, G, B] with values 0.0–1.0, e.g. [1, 1, 1] for white.' },
  { key: 'locked_color',    label: 'Locked Color',   category: 'text', type: 'color',   description: 'Color used when the element is in a locked/disabled state.' },
  { key: 'shadow',          label: 'Shadow',         category: 'text', type: 'boolean', description: 'Whether to render a drop shadow behind the text.' },
  { key: 'hide_hyphen',     label: 'Hide Hyphen',    category: 'text', type: 'boolean', description: 'Suppress hyphens when text wraps across lines.' },
  { key: 'notify_on_ellipses', label: 'Notify Ellipses', category: 'text', type: 'json', description: 'Sibling controls to notify when this label is truncated (ellipsis shown).' },
  { key: 'enable_profanity_filter', label: 'Profanity Filter', category: 'text', type: 'boolean', description: 'Apply the platform profanity filter to this text.' },
  { key: 'locked_alpha',    label: 'Locked Alpha',   category: 'text', type: 'number',  description: 'Overrides alpha when the element is locked/disabled.' },
  { key: 'font_size',       label: 'Font Size',      category: 'text', type: 'select',  options: FONT_SIZES, description: 'Font size: small, normal, large, or extra_large.' },
  { key: 'font_scale_factor', label: 'Font Scale',   category: 'text', type: 'number',  description: 'Multiplier applied on top of font_size. e.g. 2.0 doubles the size.' },
  { key: 'font_type',       label: 'Font Type',      category: 'text', type: 'select',  options: FONT_TYPES, description: 'Font to use: default, smooth, rune, MinecraftTen, or unicode.' },
  { key: 'backup_font_type', label: 'Backup Font',   category: 'text', type: 'select',  options: FONT_TYPES, description: 'Fallback font if the primary font cannot render a character.' },
  { key: 'text_alignment',  label: 'Text Alignment', category: 'text', type: 'select',  options: TEXT_ALIGN, description: 'Horizontal alignment of text: left, center, or right.' },
  { key: 'localize',        label: 'Localize',       category: 'text', type: 'boolean', description: 'Whether the text value is a localization key to be translated.' },
  { key: 'line_padding',    label: 'Line Padding',   category: 'text', type: 'number',  description: 'Extra vertical spacing (in pixels) between lines of wrapped text.' },
  { key: 'use_place_holder', label: 'Use Placeholder', category: 'text', type: 'boolean', description: 'Show placeholder text when the edit box is empty.' },
  { key: 'place_holder_text', label: 'Placeholder Text', category: 'text', type: 'string', description: 'Text shown inside an empty edit box.' },
  { key: 'place_holder_text_color', label: 'Placeholder Color', category: 'text', type: 'color', description: 'Color of the placeholder text.' },

  // Image/Sprite
  { key: 'texture',         label: 'Texture',        category: 'image', type: 'string',  description: 'Texture path relative to the resource pack root, e.g. textures/ui/my_image (no extension).' },
  { key: 'uv',              label: 'UV',             category: 'image', type: 'size',    description: 'UV start coordinate as [u, v] in pixels from top-left of the texture.' },
  { key: 'uv_size',         label: 'UV Size',        category: 'image', type: 'size',    description: 'Size of the UV region to sample from the texture as [width, height] in pixels.' },
  { key: 'texture_file_system', label: 'File System', category: 'image', type: 'string', description: 'Override which file system to load the texture from.' },
  { key: 'nineslice_size',  label: 'Nineslice',      category: 'image', type: 'json',    description: 'Nine-slice border insets as a single number or [top, right, bottom, left]. Stretches center, preserves corners.' },
  { key: 'tiled',           label: 'Tiled',          category: 'image', type: 'boolean', description: 'Tile (repeat) the texture instead of stretching it.' },
  { key: 'tiled_scale',     label: 'Tiled Scale',    category: 'image', type: 'size',    description: 'Scale factor when tiling the texture.' },
  { key: 'keep_ratio',      label: 'Keep Ratio',     category: 'image', type: 'boolean', description: 'Maintain aspect ratio when the element is resized.' },
  { key: 'bilinear',        label: 'Bilinear',       category: 'image', type: 'boolean', description: 'Use bilinear filtering (smooth) instead of nearest-neighbor (pixelated) when scaling.' },
  { key: 'fill',            label: 'Fill',           category: 'image', type: 'boolean', description: 'Scale the texture to fill the element, potentially cropping it.' },
  { key: 'fit_to_width',    label: 'Fit to Width',   category: 'image', type: 'boolean', description: 'Scale texture so its width matches the element width.' },
  { key: 'grayscale',       label: 'Grayscale',      category: 'image', type: 'boolean', description: 'Render the texture in grayscale.' },
  { key: 'force_texture_reload', label: 'Force Reload', category: 'image', type: 'boolean', description: 'Force the texture to reload from disk on every render.' },
  { key: 'clip_direction',  label: 'Clip Direction', category: 'image', type: 'select',  options: CLIP_DIRECTIONS, description: 'Direction from which the image is revealed when clip_ratio < 1. Used for progress bars.' },
  { key: 'clip_ratio',      label: 'Clip Ratio',     category: 'image', type: 'number',  description: 'How much of the image is visible (0.0–1.0) when using directional clipping.' },
  { key: 'clip_pixelperfect', label: 'Clip Pixel Perfect', category: 'image', type: 'boolean', description: 'Align the clip edge to exact pixel boundaries.' },
  { key: 'pixel_perfect',   label: 'Pixel Perfect',  category: 'image', type: 'boolean', description: 'Render the texture at exact pixel alignment, avoiding sub-pixel blurring.' },
  { key: 'base_size',       label: 'Base Size',      category: 'image', type: 'size',    description: 'The intrinsic pixel size of the source texture artwork, used with nineslice.' },
  { key: 'zip_folder',      label: 'Zip Folder',     category: 'image', type: 'string',  description: 'Path to a zip archive to load the texture from.' },
  { key: 'allow_debug_missing_texture', label: 'Allow Missing Texture', category: 'image', type: 'boolean', description: 'Suppress the missing-texture error in debug mode.' },
  { key: 'color_corrected', label: 'Color Corrected', category: 'image', type: 'boolean', description: 'Apply sRGB color correction to this texture.' },

  // Sound
  { key: 'sound_name',      label: 'Sound Name',    category: 'button', type: 'string',  description: 'Sound event to play on interaction, e.g. random.click.' },
  { key: 'sound_volume',    label: 'Sound Volume',  category: 'button', type: 'number',  description: 'Volume multiplier for the interaction sound (0.0–1.0).' },
  { key: 'sound_pitch',     label: 'Sound Pitch',   category: 'button', type: 'number',  description: 'Pitch multiplier for the interaction sound.' },

  // Button
  { key: 'default_control', label: 'Default Control', category: 'button', type: 'string', description: 'Name of child control shown in the default (idle) state.' },
  { key: 'hover_control',   label: 'Hover Control',   category: 'button', type: 'string', description: 'Name of child control shown when the button is hovered.' },
  { key: 'pressed_control', label: 'Pressed Control', category: 'button', type: 'string', description: 'Name of child control shown while the button is held/pressed.' },
  { key: 'locked_control',  label: 'Locked Control',  category: 'button', type: 'string', description: 'Name of child control shown when the button is locked/disabled.' },

  // Toggle
  { key: 'toggle_name',     label: 'Toggle Name',    category: 'toggle', type: 'string',  description: 'Identifier for this toggle. Used for radio groups and bindings.' },
  { key: 'toggle_default_state', label: 'Default State', category: 'toggle', type: 'boolean', description: 'The initial checked/unchecked state of the toggle.' },
  { key: 'radio_toggle_group', label: 'Radio Group', category: 'toggle', type: 'boolean', description: 'When true, only one toggle in the same group can be selected at a time (radio behavior).' },
  { key: 'toggle_group_forced_index', label: 'Group Forced Index', category: 'toggle', type: 'number', description: 'Forces this toggle to use a specific index within its radio group.' },
  { key: 'toggle_group_default_selected', label: 'Group Default Selected', category: 'toggle', type: 'number', description: 'Index of the toggle selected by default within the radio group.' },
  { key: 'reset_on_focus_lost', label: 'Reset on Focus Lost', category: 'toggle', type: 'boolean', description: 'Return toggle to unchecked state when it loses focus.' },
  { key: 'toggle_on_hover', label: 'Toggle On Hover', category: 'toggle', type: 'string', description: 'Button event ID that activates when the toggle is hovered.' },
  { key: 'toggle_on_button', label: 'Toggle On Button', category: 'toggle', type: 'string', description: 'Button event ID that turns the toggle on.' },
  { key: 'toggle_off_button', label: 'Toggle Off Button', category: 'toggle', type: 'string', description: 'Button event ID that turns the toggle off.' },
  { key: 'enable_directional_toggling', label: 'Directional Toggling', category: 'toggle', type: 'boolean', description: 'Allow d-pad/arrow keys to change toggle state.' },
  { key: 'toggle_grid_collection_name', label: 'Grid Collection Name', category: 'toggle', type: 'string', description: 'Collection name used to power a grid of toggle items.' },
  { key: 'checked_control',         label: 'Checked Control',          category: 'toggle', type: 'string', description: 'Child control shown when the toggle is checked.' },
  { key: 'unchecked_control',        label: 'Unchecked Control',         category: 'toggle', type: 'string', description: 'Child control shown when the toggle is unchecked.' },
  { key: 'checked_hover_control',    label: 'Checked Hover',            category: 'toggle', type: 'string', description: 'Child control shown when the toggle is checked and hovered.' },
  { key: 'unchecked_hover_control',  label: 'Unchecked Hover',          category: 'toggle', type: 'string', description: 'Child control shown when the toggle is unchecked and hovered.' },
  { key: 'checked_locked_control',   label: 'Checked Locked',           category: 'toggle', type: 'string', description: 'Child control shown when the toggle is checked and locked.' },
  { key: 'unchecked_locked_control', label: 'Unchecked Locked',         category: 'toggle', type: 'string', description: 'Child control shown when the toggle is unchecked and locked.' },
  { key: 'checked_locked_hover_control',   label: 'Checked Locked Hover',   category: 'toggle', type: 'string', description: 'Child control shown when checked, locked, and hovered.' },
  { key: 'unchecked_locked_hover_control', label: 'Unchecked Locked Hover', category: 'toggle', type: 'string', description: 'Child control shown when unchecked, locked, and hovered.' },

  // Dropdown 
  { key: 'dropdown_name',            label: 'Dropdown Name',    category: 'toggle', type: 'string', description: 'Identifier for this dropdown toggle.' },
  { key: 'dropdown_content_control', label: 'Content Control',  category: 'toggle', type: 'string', description: 'Name of the child control panel that contains the dropdown items.' },
  { key: 'dropdown_area',            label: 'Dropdown Area',    category: 'toggle', type: 'string', description: 'Name of the clickable area control that opens/closes the dropdown.' },

  // Slider
  { key: 'slider_name',           label: 'Slider Name',          category: 'slider', type: 'string',  description: 'Identifier for the slider, used in bindings.' },
  { key: 'slider_steps',          label: 'Steps',                category: 'slider', type: 'number',  description: 'Number of discrete steps in the slider range.' },
  { key: 'slider_direction',      label: 'Direction',            category: 'slider', type: 'string',  description: 'Axis along which the slider moves: "horizontal" or "vertical".' },
  { key: 'slider_timeout',        label: 'Timeout',              category: 'slider', type: 'number',  description: 'Time (seconds) before the slider auto-returns to default.' },
  { key: 'slider_track_button',   label: 'Track Button',         category: 'slider', type: 'string',  description: 'Button event that updates the slider when the track is tapped.' },
  { key: 'slider_small_decrease_button', label: 'Small Decrease Button', category: 'slider', type: 'string', description: 'Button event ID for the small step decrease action.' },
  { key: 'slider_small_increase_button', label: 'Small Increase Button', category: 'slider', type: 'string', description: 'Button event ID for the small step increase action.' },
  { key: 'slider_selected_button',   label: 'Selected Button',   category: 'slider', type: 'string', description: 'Button event ID fired when the slider thumb is selected.' },
  { key: 'slider_deselected_button', label: 'Deselected Button', category: 'slider', type: 'string', description: 'Button event ID fired when the slider thumb is deselected.' },
  { key: 'slider_box_control',    label: 'Box Control',          category: 'slider', type: 'string',  description: 'Name of the child control used as the draggable slider thumb.' },
  { key: 'slider_collection_name', label: 'Collection Name',     category: 'slider', type: 'string',  description: 'Collection to use when the slider controls a list of items.' },
  { key: 'background_control',       label: 'Background Control',       category: 'slider', type: 'string', description: 'Background child control shown at rest.' },
  { key: 'background_hover_control', label: 'Background Hover Control', category: 'slider', type: 'string', description: 'Background child control shown on hover.' },
  { key: 'progress_control',         label: 'Progress Control',         category: 'slider', type: 'string', description: 'Child control that reflects the current slider fill/progress.' },
  { key: 'progress_hover_control',   label: 'Progress Hover Control',   category: 'slider', type: 'string', description: 'Child control for the progress fill shown on hover.' },

  // Grid
  { key: 'grid_dimensions',    label: 'Grid Dimensions',   category: 'grid', type: 'size',   description: 'Number of columns and rows in the grid as [columns, rows].' },
  { key: 'maximum_grid_items', label: 'Max Items',         category: 'grid', type: 'number', description: 'Maximum number of items shown in the grid at once.' },
  { key: 'grid_item_template', label: 'Item Template',     category: 'grid', type: 'string', description: 'Name of the control definition used as the template for each grid cell.' },
  { key: 'grid_dimension_binding', label: 'Dimension Binding', category: 'grid', type: 'string', description: 'Binding that supplies the grid dimensions at runtime.' },
  { key: 'grid_rescaling_type', label: 'Rescaling',        category: 'grid', type: 'select', options: GRID_RESCALING, description: 'How the grid resizes its cells when space changes.' },
  { key: 'grid_fill_direction', label: 'Fill Direction',   category: 'grid', type: 'select', options: GRID_FILL_DIR,  description: 'Order in which grid cells are populated.' },
  { key: 'precached_grid_item_count', label: 'Precached Items', category: 'grid', type: 'number', description: 'Number of grid item controls to pre-create for performance.' },
  { key: 'collection_name',    label: 'Collection Name',   category: 'grid', type: 'string', description: 'Name of the runtime collection that provides data for each grid cell.' },

  // Edit Box
  { key: 'text_box_name',  label: 'Text Box Name',   category: 'input', type: 'string',  description: 'Identifier for this text box, used in bindings.' },
  { key: 'text_type',      label: 'Text Type',       category: 'input', type: 'select',  options: TEXT_TYPES, description: 'Restricts accepted characters: ExtendedASCII, IdentifierChars, or NumberChars.' },
  { key: 'max_length',     label: 'Max Length',      category: 'input', type: 'number',  description: 'Maximum number of characters allowed in the text box.' },
  { key: 'enabled_newline', label: 'Enabled Newline', category: 'input', type: 'boolean', description: 'Allow multi-line input by pressing Enter.' },
  { key: 'constrain_to_rect', label: 'Constrain to Rect', category: 'input', type: 'boolean', description: 'Keep the cursor/text within the element bounds.' },
  { key: 'text_control',      label: 'Text Control',      category: 'input', type: 'string', description: 'Name of the child control that displays the typed text.' },
  { key: 'place_holder_control', label: 'Placeholder Control', category: 'input', type: 'string', description: 'Name of the child control shown as placeholder text.' },
  { key: 'can_be_deselected',  label: 'Can Be Deselected', category: 'input', type: 'boolean', description: 'Allow the text box to lose focus/selection.' },
  { key: 'always_listening',   label: 'Always Listening',  category: 'input', type: 'boolean', description: 'Receive text input even when not focused.' },
  { key: 'virtual_keyboard_buffer_control', label: 'VK Buffer Control', category: 'input', type: 'string', description: 'Control name used as the virtual keyboard input buffer.' },

  // Input/Focus
  { key: 'modal',               label: 'Modal',              category: 'input', type: 'boolean', description: 'Element acts as a modal overlay, blocking input to elements below it.' },
  { key: 'inline_modal',        label: 'Inline Modal',       category: 'input', type: 'boolean', description: 'Modal behavior scoped to this element\'s parent rather than the whole screen.' },
  { key: 'always_listen_to_input', label: 'Always Listen',  category: 'input', type: 'boolean', description: 'Receive input events even when another modal is open.' },
  { key: 'always_handle_pointer', label: 'Handle Pointer',  category: 'input', type: 'boolean', description: 'Always process pointer (mouse/touch) events, even when obscured.' },
  { key: 'always_handle_controller_direction', label: 'Handle Controller Dir', category: 'input', type: 'boolean', description: 'Always handle gamepad directional input.' },
  { key: 'hover_enabled',        label: 'Hover Enabled',    category: 'input', type: 'boolean', description: 'Enable hover state detection for this element.' },
  { key: 'prevent_touch_input',  label: 'Prevent Touch',    category: 'input', type: 'boolean', description: 'Block touch input from reaching this element.' },
  { key: 'consume_event',        label: 'Consume Event',    category: 'input', type: 'boolean', description: 'Stop the input event from propagating to elements below.' },
  { key: 'consume_hover_events', label: 'Consume Hover',    category: 'input', type: 'boolean', description: 'Stop hover events from propagating.' },
  { key: 'default_focus_precedence', label: 'Focus Precedence', category: 'input', type: 'number', description: 'Priority for receiving the initial focus when the screen opens.' },
  { key: 'focus_enabled',        label: 'Focus Enabled',    category: 'input', type: 'boolean', description: 'Whether this element can receive keyboard/gamepad focus.' },
  { key: 'focus_wrap_enabled',   label: 'Focus Wrap',       category: 'input', type: 'boolean', description: 'Wrap focus around when navigating past the first or last focusable element.' },
  { key: 'focus_magnet_enabled', label: 'Focus Magnet',     category: 'input', type: 'boolean', description: 'Attract focus to this element when nearby.' },
  { key: 'focus_identifier',     label: 'Focus ID',         category: 'input', type: 'string',  description: 'Unique ID used to reference this element as a focus target.' },
  { key: 'focus_change_down',    label: 'Focus Down',       category: 'input', type: 'string',  description: 'Focus identifier of the element to navigate to when pressing down.' },
  { key: 'focus_change_up',      label: 'Focus Up',         category: 'input', type: 'string',  description: 'Focus identifier of the element to navigate to when pressing up.' },
  { key: 'focus_change_left',    label: 'Focus Left',       category: 'input', type: 'string',  description: 'Focus identifier of the element to navigate to when pressing left.' },
  { key: 'focus_change_right',   label: 'Focus Right',      category: 'input', type: 'string',  description: 'Focus identifier of the element to navigate to when pressing right.' },
  { key: 'focus_container',      label: 'Focus Container',  category: 'input', type: 'boolean', description: 'This element acts as a focus scope container.' },
  { key: 'use_last_focus',       label: 'Use Last Focus',   category: 'input', type: 'boolean', description: 'Restore focus to the last focused child when re-entering this container.' },

  // Scroll View
  { key: 'scrollbar_track_button', label: 'Track Button', category: 'scroll', type: 'string',  description: 'Button event ID for clicking on the scrollbar track.' },
  { key: 'scrollbar_touch_button', label: 'Touch Button', category: 'scroll', type: 'string',  description: 'Button event ID for touch interactions on the scrollbar.' },
  { key: 'scroll_speed',           label: 'Scroll Speed', category: 'scroll', type: 'number',  description: 'Pixel speed of scrolling per input event.' },
  { key: 'scrollbar_box',          label: 'Scrollbar Box', category: 'scroll', type: 'string', description: 'Name of the scrollbar thumb (draggable box) control.' },
  { key: 'scrollbar_track',        label: 'Scrollbar Track', category: 'scroll', type: 'string', description: 'Name of the scrollbar track control.' },
  { key: 'scroll_view_port',       label: 'View Port',     category: 'scroll', type: 'string', description: 'Name of the visible viewport panel inside the scroll view.' },
  { key: 'scroll_content',         label: 'Scroll Content', category: 'scroll', type: 'string', description: 'Name of the scrollable content panel (the part that moves).' },
  { key: 'scroll_box_and_track_panel', label: 'Box & Track Panel', category: 'scroll', type: 'string', description: 'Name of the panel containing both the scrollbar box and track together.' },
  { key: 'jump_to_bottom_on_update', label: 'Jump to Bottom', category: 'scroll', type: 'boolean', description: 'Auto-scroll to the end when content is updated (e.g. chat log).' },
  { key: 'allow_scroll_even_when_content_fits', label: 'Always Scrollable', category: 'scroll', type: 'boolean', description: 'Allow scrolling even when all content fits without scrolling.' },
  { key: 'scrollbar_always_visible', label: 'Always Visible', category: 'scroll', type: 'boolean', description: 'Keep the scrollbar visible even when content fits the viewport.' },
  { key: 'gesture_control_enabled', label: 'Gesture Control', category: 'scroll', type: 'boolean', description: 'Enable swipe gesture scrolling on touch devices.' },
  { key: 'always_handle_scrolling', label: 'Always Handle Scrolling', category: 'scroll', type: 'boolean', description: 'Process scroll input even when another element is focused.' },
  { key: 'touch_mode',              label: 'Touch Mode',      category: 'scroll', type: 'boolean', description: 'Optimise the scroll view for touch input.' },

  // Binding
  { key: 'bindings', label: 'Bindings', category: 'binding', type: 'bindings', description: 'Data bindings that connect UI element properties to game data.' },

  // Animations
  { key: 'anims',                 label: 'Anims',             category: 'animation', type: 'json',    description: 'Array of animation identifiers (e.g. ["@mynamespace.my_anim"]) to apply.' },
  { key: 'disable_anim_fast_forward', label: 'No Fast Forward', category: 'animation', type: 'boolean', description: 'Prevent animations from fast-forwarding to their end state on first render.' },
  { key: 'animation_reset_name', label: 'Reset Name',         category: 'animation', type: 'string',  description: 'Name of the animation state to reset to when triggered.' },
  // Animation element props (used in @animation_elements)
  { key: 'anim_type', label: 'Anim Type',   category: 'animation', type: 'select', options: ANIM_TYPES, description: 'Type of animation: alpha, color, size, offset, uv, flip_book, wait, aseprite_flip_book, or clip.' },
  { key: 'duration',  label: 'Duration',    category: 'animation', type: 'number',  description: 'Length of the animation in seconds.' },
  { key: 'next',      label: 'Next',        category: 'animation', type: 'string',  description: 'Name of the animation to play immediately after this one.' },
  { key: 'easing',    label: 'Easing',      category: 'animation', type: 'select',  options: EASING_TYPES, description: 'Interpolation curve for the animation: linear, in_bounce, out_expo, etc.' },
  { key: 'from',      label: 'From',        category: 'animation', type: 'json',    description: 'Starting value for the animated property.' },
  { key: 'to',        label: 'To',          category: 'animation', type: 'json',    description: 'Ending value for the animated property.' },
  { key: 'fps',       label: 'FPS',         category: 'animation', type: 'number',  description: 'Frames per second for flip-book animations.' },
  { key: 'frame_count', label: 'Frame Count', category: 'animation', type: 'number', description: 'Total number of frames in a flip-book animation.' },
  { key: 'frame_step', label: 'Frame Step',  category: 'animation', type: 'number',  description: 'Number of source texture rows to advance per flip-book frame.' },
  { key: 'initial_uv',  label: 'Initial UV', category: 'animation', type: 'size',   description: 'Starting UV coordinate for the first flip-book frame.' },
  { key: 'reversible',  label: 'Reversible', category: 'animation', type: 'boolean', description: 'Play the animation in reverse after it finishes (ping-pong).' },
  { key: 'resettable',  label: 'Resettable', category: 'animation', type: 'boolean', description: 'Allow the animation to be reset to its starting state.' },
  { key: 'looping',     label: 'Looping',    category: 'animation', type: 'boolean', description: 'Repeat the animation indefinitely.' },
  { key: 'activated',   label: 'Activated',  category: 'animation', type: 'boolean', description: 'Whether the animation is currently active/playing.' },
  { key: 'scale_from_starting_alpha', label: 'Scale From Starting Alpha', category: 'animation', type: 'boolean', description: 'Begin alpha animation from the element\'s current alpha instead of 0.' },
  { key: 'play_event',    label: 'Play Event',   category: 'animation', type: 'string', description: 'Event fired when the animation starts playing.' },
  { key: 'end_event',     label: 'End Event',    category: 'animation', type: 'string', description: 'Event fired when the animation finishes.' },
  { key: 'start_event',   label: 'Start Event',  category: 'animation', type: 'string', description: 'Event that triggers the animation to begin.' },
  { key: 'reset_event',   label: 'Reset Event',  category: 'animation', type: 'string', description: 'Event that resets the animation to its initial state.' },
  { key: 'destroy_at_end', label: 'Destroy at End', category: 'animation', type: 'string', description: 'Name of the control to destroy when this animation finishes.' },

  // Screen
  { key: 'render_only_when_topmost', label: 'Render Topmost', category: 'screen', type: 'boolean', description: 'Only render this screen when it is the top-most screen in the stack.' },
  { key: 'render_game_behind',       label: 'Game Behind',    category: 'screen', type: 'boolean', description: 'Render the game world behind this screen UI.' },
  { key: 'absorbs_input',            label: 'Absorbs Input',  category: 'screen', type: 'boolean', description: 'Prevent input from passing through to the game world or screens below.' },
  { key: 'is_showing_menu',          label: 'Showing Menu',   category: 'screen', type: 'boolean', description: 'Indicate to the game that this screen represents an open menu.' },
  { key: 'is_modal',                 label: 'Is Modal',       category: 'screen', type: 'boolean', description: 'Mark this screen as a modal (blocks screens below from updating).' },
  { key: 'force_render_below',       label: 'Force Below',    category: 'screen', type: 'boolean', description: 'Force the screen immediately below this one to also render.' },
  { key: 'close_on_player_hurt',     label: 'Close on Hurt',  category: 'screen', type: 'boolean', description: 'Automatically close this screen when the player takes damage.' },
  { key: 'screen_not_flushable',     label: 'Not Flushable',  category: 'screen', type: 'boolean', description: 'Prevent this screen from being removed when the screen stack is flushed.' },
  { key: 'always_accepts_input',     label: 'Always Accepts Input', category: 'screen', type: 'boolean', description: 'Process input even when the screen is not focused.' },
  { key: 'should_steal_mouse',       label: 'Steal Mouse',    category: 'screen', type: 'boolean', description: 'Capture the mouse cursor when this screen is open.' },
  { key: 'low_frequency_rendering',  label: 'Low Freq Render', category: 'screen', type: 'boolean', description: 'Render this screen at a reduced frame rate to save performance.' },
  { key: 'screen_draws_last',        label: 'Draws Last',      category: 'screen', type: 'boolean', description: 'Always draw this screen after all other screens in the stack.' },
  { key: 'cache_screen',             label: 'Cache Screen',    category: 'screen', type: 'boolean', description: 'Cache the rendered output of this screen for faster re-renders.' },
  { key: 'gamepad_cursor',           label: 'Gamepad Cursor',  category: 'screen', type: 'boolean', description: 'Display and update the gamepad navigation cursor on this screen.' },

  // Custom Renderer
  { key: 'renderer', label: 'Renderer', category: 'custom', type: 'select',
    description: 'Special built-in renderer to use for this element.',
    options: [
      'hover_text_renderer', '3d_structure_renderer', 'splash_text_renderer', 'ui_holo_cursor',
      'trial_time_renderer', 'panorama_renderer', 'actor_portrait_renderer', 'banner_pattern_renderer',
      'live_player_renderer', 'web_view_renderer', 'hunger_renderer', 'bubbles_renderer',
      'mob_effects_renderer', 'cursor_renderer', 'progress_indicator_renderer', 'camera_renderer',
      'horse_jump_renderer', 'armor_renderer', 'horse_heart_renderer', 'heart_renderer',
      'hotbar_cooldown_renderer', 'hotbar_renderer', 'hud_player_renderer', 'live_horse_renderer',
      'holographic_postrenderer', 'enchanting_book_renderer', 'debug_screen_renderer',
      'gradient_renderer', 'paper_doll_renderer', 'name_tag_renderer', 'flying_item_renderer',
      'inventory_item_renderer', 'credits_renderer', 'vignette_renderer', 'progress_bar_renderer',
      'debug_overlay_renderer', 'background_renderer', 'bundle_renderer', 'editor_gizmo_renderer',
      'dash_renderer', 'equipment_preview_renderer', 'editor_volume_highlight_renderer',
      'editor_compass_renderer', 'profile_image_renderer', 'locator_bar', 'bundle_tooltip_renderer',
      'animated_gif_renderer', 'qr_code_renderer', 'bohr_model_renderer', 'toast_renderer',
      'netease_paper_doll_renderer', 'netease_mini_map_renderer',
    ]
  },
  { key: 'camera_tilt_degrees', label: 'Camera Tilt',    category: 'custom', type: 'number',  description: 'Tilt angle in degrees for 3D model renderers.' },
  { key: 'starting_rotation',   label: 'Starting Rotation', category: 'custom', type: 'number', description: 'Initial rotation angle for 3D model or panning renderers.' },
  { key: 'rotation',            label: 'Rotation',       category: 'custom', type: 'string',  description: 'Rotation mode for the paper doll renderer (e.g. "gesture").' },
  { key: 'use_selected_skin',   label: 'Use Selected Skin', category: 'custom', type: 'boolean', description: 'Render the player\'s currently selected/equipped skin.' },
  { key: 'use_uuid',            label: 'Use UUID',       category: 'custom', type: 'boolean',  description: 'Identify the player by UUID for the renderer.' },
  { key: 'use_skin_gui_scale',  label: 'Use GUI Scale',  category: 'custom', type: 'boolean',  description: 'Scale the skin renderer using the GUI scale setting.' },
  { key: 'use_player_paperdoll', label: 'Use Paperdoll', category: 'custom', type: 'boolean',  description: 'Render the player exactly as shown in the inventory paperdoll.' },
  { key: 'animation_looped',    label: 'Animation Looped', category: 'custom', type: 'boolean', description: 'Loop the renderer\'s built-in animation.' },
  { key: 'gradient_direction',  label: 'Gradient Direction', category: 'custom', type: 'string', description: 'Direction of the gradient for gradient_renderer: "vertical" or "horizontal".' },
  { key: 'color1',              label: 'Color 1',        category: 'custom', type: 'color',   description: 'First color of the gradient_renderer.' },
  { key: 'color2',              label: 'Color 2',        category: 'custom', type: 'color',   description: 'Second color of the gradient_renderer.' },

  // Selection Wheel
  { key: 'inner_radius',         label: 'Inner Radius',  category: 'custom', type: 'number', description: 'Inner dead-zone radius of the selection wheel in pixels.' },
  { key: 'outer_radius',         label: 'Outer Radius',  category: 'custom', type: 'number', description: 'Outer boundary radius of the selection wheel in pixels.' },
  { key: 'state_controls',       label: 'State Controls', category: 'custom', type: 'json',  description: 'Array of child control names for each wheel slice state.' },
  { key: 'slice_count',          label: 'Slice Count',   category: 'custom', type: 'number', description: 'Number of slices in the selection wheel.' },
  { key: 'button_name',          label: 'Button Name',   category: 'custom', type: 'string', description: 'Button event ID attached to the selection wheel.' },
  { key: 'iterate_left_button_name',  label: 'Iterate Left',  category: 'custom', type: 'string', description: 'Button event ID to move the wheel selection left/back.' },
  { key: 'iterate_right_button_name', label: 'Iterate Right', category: 'custom', type: 'string', description: 'Button event ID to move the wheel selection right/forward.' },
  { key: 'initial_button_slice', label: 'Initial Slice', category: 'custom', type: 'number', description: 'Index of the initially selected slice when the wheel opens.' },
  { key: 'select_button_name',   label: 'Select Button', category: 'custom', type: 'string', description: 'Button event ID that confirms the current wheel selection.' },
  { key: 'hover_button_name',    label: 'Hover Button',  category: 'custom', type: 'string', description: 'Button event ID fired when hovering over a wheel slice.' },

  // TTS (Text-to-Speech)
  { key: 'tts_name',             label: 'TTS Name',       category: 'input', type: 'string',  description: 'Main label announced by the screen reader.' },
  { key: 'tts_control_header',   label: 'TTS Header',     category: 'input', type: 'string',  description: 'Header text read by the screen reader for this control.' },
  { key: 'tts_section_header',   label: 'TTS Section',    category: 'input', type: 'string',  description: 'Section header text read by the screen reader.' },
  { key: 'tts_control_type_order_priority', label: 'TTS Type Priority', category: 'input', type: 'number', description: 'Priority order for grouping controls by type in TTS narration.' },
  { key: 'tts_index_priority',   label: 'TTS Index Priority', category: 'input', type: 'number', description: 'Priority used when ordering this element within TTS narration.' },
  { key: 'tts_toggle_on',        label: 'TTS Toggle On',  category: 'input', type: 'string',  description: 'Text announced when a toggle is turned on.' },
  { key: 'tts_toggle_off',       label: 'TTS Toggle Off', category: 'input', type: 'string',  description: 'Text announced when a toggle is turned off.' },
  { key: 'tts_override_control_value', label: 'TTS Override Value', category: 'input', type: 'string', description: 'Override the value text announced by the screen reader.' },
  { key: 'tts_inherit_siblings',  label: 'TTS Inherit Siblings', category: 'input', type: 'boolean', description: 'Include sibling element TTS info in this element\'s announcement.' },
  { key: 'tts_skip_message',      label: 'TTS Skip',       category: 'input', type: 'boolean', description: 'Skip this element during TTS narration.' },
];

const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  core: 'Core',
  layout: 'Layout',
  appearance: 'Appearance',
  text: 'Text',
  image: 'Image / Sprite',
  button: 'Button / Sound',
  toggle: 'Toggle / Dropdown',
  slider: 'Slider',
  grid: 'Grid',
  scroll: 'Scroll View',
  input: 'Input / Focus / TTS',
  binding: 'Bindings',
  animation: 'Animation',
  screen: 'Screen',
  custom: 'Custom Renderer',
  variables: 'Variables',
};

/** Inspector panel - shows and edits properties of selected control */
export class InspectorPanel {
  private readonly container: HTMLElement;
  private currentFile: string | null = null;
  private currentControl: string | null = null;
  private expandedCategories = new Set<PropertyCategory>(['core', 'layout', 'binding']);

  constructor(
    containerId: string,
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;
    this.events.on('control:selected', (data) => {
      if (data) {
        this.currentFile = data.filePath;
        this.currentControl = data.controlName;
        this.render();
      }
    });
    this.events.on('control:updated', () => this.render());
    this.events.on('inspector:refresh', () => this.render());
    onLangChange(() => this.render());
  }

  /** Render the inspector */
  render(): void {
    const scrollTop = this.container.scrollTop;
    clearElement(this.container);
    const header = el('div', { className: 'panel-header' },
      el('span', { className: 'panel-title' }, t('inspector.title'))
    );
    this.container.appendChild(header);
    if (!this.currentFile || !this.currentControl) {
      this.container.appendChild(
        el('div', { className: 'inspector-empty' }, t('inspector.selectControl'))
      );
      return;
    }

    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control) {
      this.container.appendChild(
        el('div', { className: 'inspector-empty' }, t('inspector.notFound'))
      );
      return;
    }
    // Control name display
    const nameSection = el('div', { className: 'inspector-name' },
      el('label', {}, 'Name'),
      el('input', {
        type: 'text',
        value: this.currentControl,
        className: 'inspector-input',
        onchange: (e: Event) => {
          const newName = (e.target as HTMLInputElement).value.trim();
          if (newName && newName !== this.currentControl) {
            this.renameControl(newName);
          }
        }
      })
    );
    this.container.appendChild(nameSection);
    // Group properties by category
    const categorized = new Map<PropertyCategory, PropertyMeta[]>();
    for (const prop of PROPERTY_DEFINITIONS) {
      if (!categorized.has(prop.category)) categorized.set(prop.category, []);
      categorized.get(prop.category)!.push(prop);
    }
    // Render each category
    for (const [category, props] of categorized) {
      const hasValues = props.some(p => (control as Record<string, unknown>)[p.key] !== undefined);
      if (!hasValues && !this.expandedCategories.has(category)) {
        // Show collapsed section
        const section = el('div', { className: 'inspector-category collapsed' },
          el('div', {
            className: 'category-header',
            onclick: () => { this.expandedCategories.add(category); this.render(); }
          },
            el('span', { className: 'category-expand' }, '▶'),
            el('span', {}, CATEGORY_LABELS[category])
          )
        );
        this.container.appendChild(section);
        continue;
      }
      const section = el('div', { className: 'inspector-category' });
      const sectionHeader = el('div', {
        className: 'category-header',
        onclick: () => {
          if (this.expandedCategories.has(category)) {
            this.expandedCategories.delete(category);
          } else this.expandedCategories.add(category);
          this.render();
        }
      },
        el('span', { className: 'category-expand' }, this.expandedCategories.has(category) ? '▼' : '▶'),
        el('span', {}, CATEGORY_LABELS[category])
      );
      section.appendChild(sectionHeader);
      if (this.expandedCategories.has(category)) {
        for (const prop of props) 
          section.appendChild(this.renderProperty(prop, control));
      }
      this.container.appendChild(section);
    }
    // Variables section ($-prefixed)
    const variables = Object.entries(control)
      .filter(([k]) => k.startsWith('$'));
    if (variables.length > 0 || this.expandedCategories.has('variables')) {
      const varsSection = el('div', { className: 'inspector-category' });
      varsSection.appendChild(
        el('div', {
          className: 'category-header',
          onclick: () => {
            if (this.expandedCategories.has('variables')) this.expandedCategories.delete('variables');
            else this.expandedCategories.add('variables');
            this.render();
          }
        },
          el('span', { className: 'category-expand' }, this.expandedCategories.has('variables') ? '▼' : '▶'),
          el('span', {}, CATEGORY_LABELS['variables']),
          el('button', {
            className: 'icon-btn small',
            title: 'Add Variable',
            onclick: (e: Event) => {
              e.stopPropagation();
              this.addVariable();
            }
          }, '+')
        )
      );
      if (this.expandedCategories.has('variables')) {
        for (const [varName, varValue] of variables) 
          varsSection.appendChild(this.renderVariableField(varName, varValue));
      }
      this.container.appendChild(varsSection);
    }
    // Add raw JSON editor button
    this.container.appendChild(
      el('div', { className: 'inspector-actions' },
        el('button', {
          className: 'btn',
          onclick: () => this.editRawJSON()
        }, 'Edit Raw JSON'),
        el('button', {
          className: 'btn',
          onclick: () => this.addProperty()
        }, 'Add Property')
      )
    );
    // Restore scroll position after re-render
    requestAnimationFrame(() => {
      this.container.scrollTop = scrollTop;
    });
  }

  private renderProperty(prop: PropertyMeta, control: UIControlProperties): HTMLElement {
    const value = (control as Record<string, unknown>)[prop.key];
    const row = el('div', { className: `inspector-row${value !== undefined ? ' has-value' : ''}` });
    const labelWrap = el('div', { className: 'inspector-label-wrap' });
    const label = el('label', { className: 'inspector-label' }, prop.label);
    labelWrap.appendChild(label);
    if (prop.description) {
      const tip = el('button', {
        className: 'prop-help-btn',
        type: 'button',
        title: prop.description,
        'aria-label': `Help: ${prop.label}`,
      }, '?');
      labelWrap.appendChild(tip);
    }
    row.appendChild(labelWrap);
    switch (prop.type) {
      case 'string':
        row.appendChild(this.createStringInput(prop.key, value as string | undefined));
        break;
      case 'number':
        row.appendChild(this.createNumberInput(prop.key, value as number | undefined));
        break;
      case 'boolean':
        row.appendChild(this.createBooleanInput(prop.key, value as boolean | undefined));
        break;
      case 'select':
        row.appendChild(this.createSelectInput(prop.key, value as string | undefined, prop.options ?? []));
        break;
      case 'color':
        row.appendChild(this.createColorInput(prop.key, value as ColorValue | undefined));
        break;
      case 'size':
        row.appendChild(this.createSizeInput(prop.key, value as SizeValue | undefined));
        break;
      case 'json':
        row.appendChild(this.createJsonInput(prop.key, value));
        break;
      case 'bindings':
        row.appendChild(this.createBindingsEditor(value as BindingEntry[] | undefined));
        break;
    }
    // Clear button
    if (value !== undefined) {
      row.appendChild(
        el('button', {
          className: 'icon-btn small clear-btn',
          title: 'Remove property',
          onclick: () => this.updateProperty(prop.key, undefined)
        }, 'x')
      );
    }
    return row;
  }

  private createStringInput(key: string, value: string | undefined): HTMLElement {
    return el('input', {
      type: 'text',
      value: value ?? '',
      className: 'inspector-input',
      placeholder: 'Enter value...',
      onchange: (e: Event) => {
        const v = (e.target as HTMLInputElement).value;
        this.updateProperty(key, v || undefined);
      }
    });
  }

  private createNumberInput(key: string, value: number | undefined): HTMLElement {
    return el('input', {
      type: 'number',
      value: value !== undefined ? String(value) : '',
      className: 'inspector-input',
      step: '0.1',
      placeholder: '0',
      onchange: (e: Event) => {
        const v = (e.target as HTMLInputElement).value;
        this.updateProperty(key, v ? parseFloat(v) : undefined);
      }
    });
  }

  private createBooleanInput(key: string, value: boolean | string | undefined): HTMLElement {
    const container = el('div', { className: 'bool-input' });
    const isVariable = typeof value === 'string';

    if (isVariable) {
      container.appendChild(el('input', {
        type: 'text',
        value: value as string,
        className: 'inspector-input',
        placeholder: '$variable_name',
        onchange: (e: Event) => {
          const v = (e.target as HTMLInputElement).value.trim();
          if (v === '' || v === 'true') this.updateProperty(key, v === '' ? undefined : true);
          else if (v === 'false') this.updateProperty(key, false);
          else this.updateProperty(key, v);
        }
      }));
      container.appendChild(el('button', {
        className: 'icon-btn small',
        title: 'Switch to boolean',
        onclick: () => { this.updateProperty(key, true); }
      }, '⊘'));
    } else {
      const select = el('select', {
        className: 'inspector-input',
        onchange: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          if (v === '') this.updateProperty(key, undefined);
          else this.updateProperty(key, v === 'true');
        }
      },
        el('option', { value: '', selected: value === undefined }, '--'),
        el('option', { value: 'true', selected: value === true }, 'true'),
        el('option', { value: 'false', selected: value === false }, 'false')
      );
      container.appendChild(select);
      container.appendChild(el('button', {
        className: 'icon-btn small',
        title: 'Use $variable',
        onclick: () => { this.updateProperty(key, '$'); }
      }, '$'));
    }

    return container;
  }

  private createSelectInput(key: string, value: string | undefined, options: readonly string[]): HTMLElement {
    const select = el('select', {
      className: 'inspector-input',
      onchange: (e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        this.updateProperty(key, v || undefined);
      }
    },
      el('option', { value: '' }, '--'),
      ...options.map(opt =>
        el('option', { value: opt, selected: value === opt }, opt)
      )
    );
    return select;
  }

  private createColorInput(key: string, value: ColorValue | undefined): HTMLElement {
    const container = el('div', { className: 'color-input' });
    const displayVal = Array.isArray(value) ? `[${value.join(', ')}]` : (value ?? '');
    container.appendChild(
      el('input', {
        type: 'text',
        value: String(displayVal),
        className: 'inspector-input',
        placeholder: '[1.0, 1.0, 1.0]',
        onchange: (e: Event) => {
          const v = (e.target as HTMLInputElement).value.trim();
          if (!v) { this.updateProperty(key, undefined); return; }
          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) this.updateProperty(key, parsed);
          } catch {
            showToast('Invalid color format. Use [R, G, B] with values 0-1', 'error');
          }
        }
      })
    );
    return container;
  }

  private createSizeInput(key: string, value: SizeValue | undefined): HTMLElement {
    const container = el('div', { className: 'size-input' });

    if (Array.isArray(value)) {
      const x = el('input', {
        type: 'text',
        value: String(value[0]),
        className: 'inspector-input half',
        placeholder: 'X',
        onchange: () => this.updateSizeFromInputs(key, x, y)
      });
      const y = el('input', {
        type: 'text',
        value: String(value[1]),
        className: 'inspector-input half',
        placeholder: 'Y',
        onchange: () => this.updateSizeFromInputs(key, x, y)
      });
      container.appendChild(x);
      container.appendChild(y);
    } else {
      container.appendChild(
        el('input', {
          type: 'text',
          value: value !== undefined ? String(value) : '',
          className: 'inspector-input',
          placeholder: '["100%", 20] or number',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value.trim();
            if (!v) { this.updateProperty(key, undefined); return; }
            try {
              const parsed = JSON.parse(v);
              this.updateProperty(key, parsed);
            } catch {
              // try as single value
              const num = parseFloat(v);
              this.updateProperty(key, isNaN(num) ? v : num);
            }
          }
        })
      );
    }
    return container;
  }

  private updateSizeFromInputs(key: string, xInput: HTMLElement, yInput: HTMLElement): void {
    const xVal = (xInput as HTMLInputElement).value.trim();
    const yVal = (yInput as HTMLInputElement).value.trim();
    const parseVal = (v: string): string | number => {
      const n = parseFloat(v);
      return isNaN(n) ? v : n;
    };
    this.updateProperty(key, [parseVal(xVal), parseVal(yVal)]);
  }

  private createJsonInput(key: string, value: unknown): HTMLElement {
    return el('textarea', {
      className: 'inspector-input json-input',
      value: value !== undefined ? JSON.stringify(value, null, 2) : '',
      rows: '3',
      placeholder: 'JSON value...',
      onchange: (e: Event) => {
        const v = (e.target as HTMLTextAreaElement).value.trim();
        if (!v) { this.updateProperty(key, undefined); return; }
        try {
          this.updateProperty(key, JSON.parse(v));
        } catch {
          showToast(`Invalid JSON for ${key}`, 'error');
        }
      }
    });
  }

  private createBindingsEditor(bindings: BindingEntry[] | undefined): HTMLElement {
    const container = el('div', { className: 'bindings-editor' });
    if (bindings && bindings.length > 0) {
      for (let i = 0; i < bindings.length; i++) 
        container.appendChild(this.renderBindingEntry(bindings[i], i));
    }
    container.appendChild(
      el('button', {
        className: 'btn small',
        onclick: () => this.addBinding()
      }, '+ Add Binding')
    );
    return container;
  }

  private renderBindingEntry(binding: BindingEntry, index: number): HTMLElement {
    const entry = el('div', { className: 'binding-entry' },
      el('div', { className: 'binding-header' },
        el('span', {}, `Binding ${index + 1}`),
        el('button', {
          className: 'icon-btn small danger',
          onclick: () => this.removeBinding(index)
        }, 'x')
      ),
      // Binding type
      el('div', { className: 'binding-field' },
        el('label', {}, 'Type'),
        el('select', {
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            this.updateBinding(index, 'binding_type', v || undefined);
          }
        },
          el('option', { value: '' }, '--'),
          ...['global', 'collection', 'collection_details', 'view', 'none'].map(t =>
            el('option', { value: t, selected: binding.binding_type === t }, t)
          )
        )
      ),
      // Binding name
      el('div', { className: 'binding-field' },
        el('label', {}, 'Name'),
        el('input', {
          type: 'text',
          value: binding.binding_name ?? '',
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            this.updateBinding(index, 'binding_name', v || undefined);
          }
        })
      ),
      // Collection name
      el('div', { className: 'binding-field' },
        el('label', {}, 'Collection'),
        el('input', {
          type: 'text',
          value: binding.binding_collection_name ?? '',
          className: 'inspector-input',
          placeholder: 'form_buttons',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            this.updateBinding(index, 'binding_collection_name', v || undefined);
          }
        })
      ),
      // Source property
      el('div', { className: 'binding-field' },
        el('label', {}, 'Source Prop'),
        el('input', {
          type: 'text',
          value: binding.source_property_name ?? '',
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            this.updateBinding(index, 'source_property_name', v || undefined);
          }
        })
      ),
      // Target property
      el('div', { className: 'binding-field' },
        el('label', {}, 'Target Prop'),
        el('input', {
          type: 'text',
          value: binding.target_property_name ?? '',
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            this.updateBinding(index, 'target_property_name', v || undefined);
          }
        })
      ),
      // Binding name override
      el('div', { className: 'binding-field' },
        el('label', {}, 'Name Override'),
        el('input', {
          type: 'text',
          value: binding.binding_name_override ?? '',
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            this.updateBinding(index, 'binding_name_override', v || undefined);
          }
        })
      ),
      // Source control name
      el('div', { className: 'binding-field' },
        el('label', {}, 'Source Control'),
        el('input', {
          type: 'text',
          value: binding.source_control_name ?? '',
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            this.updateBinding(index, 'source_control_name', v || undefined);
          }
        })
      ),
      // Binding condition
      el('div', { className: 'binding-field' },
        el('label', {}, 'Condition'),
        el('select', {
          className: 'inspector-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            this.updateBinding(index, 'binding_condition', v || undefined);
          }
        },
          el('option', { value: '' }, '--'),
          ...['always', 'visible', 'once', 'always_when_visible', 'visibility_changed', 'none'].map(t =>
            el('option', { value: t, selected: binding.binding_condition === t }, t)
          )
        )
      )
    );
    return entry;
  }

  private addBinding(): void {
    if (!this.currentFile || !this.currentControl) return;
    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control) return;
    if (!control.bindings) control.bindings = [];
    control.bindings.push({ binding_type: 'collection' });
    this.projectManager.updateControl(this.currentFile, this.currentControl, control);
  }

  private removeBinding(index: number): void {
    if (!this.currentFile || !this.currentControl) return;
    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control?.bindings) return;
    control.bindings.splice(index, 1);
    if (control.bindings.length === 0) delete control.bindings;
    this.projectManager.updateControl(this.currentFile, this.currentControl, control);
  }

  private updateBinding(index: number, key: keyof BindingEntry, value: unknown): void {
    if (!this.currentFile || !this.currentControl) return;
    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control?.bindings?.[index]) return;
    if (value === undefined) {
      delete (control.bindings[index] as Record<string, unknown>)[key];
    } else (control.bindings[index] as Record<string, unknown>)[key] = value;
    this.projectManager.updateControl(this.currentFile, this.currentControl, control);
  }

  private renderVariableField(name: string, value: unknown): HTMLElement {
    return el('div', { className: 'inspector-row has-value variable-row' },
      el('label', { className: 'inspector-label' }, name),
      el('input', {
        type: 'text',
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        className: 'inspector-input',
        onchange: (e: Event) => {
          const v = (e.target as HTMLInputElement).value.trim();
          let parsed: unknown = v;
          try { parsed = JSON.parse(v); } catch { /* keep as string */ }
          this.updateProperty(name, parsed);
        }
      }),
      el('button', {
        className: 'icon-btn small danger',
        onclick: () => this.updateProperty(name, undefined)
      }, 'x')
    );
  }

  private updateProperty(key: string, value: unknown): void {
    if (!this.currentFile || !this.currentControl) return;
    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control) return;
    if (value === undefined) {
      delete (control as Record<string, unknown>)[key];
    } else (control as Record<string, unknown>)[key] = value;
    this.projectManager.updateControl(this.currentFile, this.currentControl, control);
  }

  private renameControl(newName: string): void {
    if (!this.currentFile || !this.currentControl) return;
    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control) return;
    this.projectManager.deleteControl(this.currentFile, this.currentControl);
    this.projectManager.addControl(this.currentFile, newName, control);
    this.currentControl = newName;
    this.events.emit('control:selected', { filePath: this.currentFile, controlName: newName });
  }

  private addVariable(): void {
    const name = prompt('Variable name (with $ prefix):');
    if (!name) return;
    const varName = name.startsWith('$') ? name : `$${name}`;
    this.updateProperty(varName, '');
  }

  private addProperty(): void {
    const key = prompt('Property name:');
    if (!key) return;
    const value = prompt('Value (JSON or plain text):');
    if (value === null) return;
    let parsed: unknown = value;
    try { parsed = JSON.parse(value); } catch { /* keep as string */ }
    this.updateProperty(key, parsed);
  }

  private editRawJSON(): void {
    if (!this.currentFile || !this.currentControl) return;
    const control = this.projectManager.getControl(this.currentFile, this.currentControl);
    if (!control) return;
    const textarea = el('textarea', {
      className: 'raw-json-editor',
      rows: '20',
      value: JSON.stringify(control, null, 2),
    }) as HTMLTextAreaElement;
    const saveBtn = el('button', {
      className: 'btn primary',
      onclick: () => {
        try {
          const parsed = JSON.parse(textarea.value);
          this.projectManager.updateControl(this.currentFile!, this.currentControl!, parsed);
          import('../shared/DomUtils').then(m => m.closeModal());
          this.render();
          showToast('Control updated', 'info');
        } catch {
          showToast('Invalid JSON', 'error');
        }
      }
    }, 'Save');
    const content = el('div', { className: 'raw-editor-container' }, textarea, saveBtn);
    import('../shared/DomUtils').then(m => m.showModal(`Edit: ${this.currentControl}`, content));
  }
}
