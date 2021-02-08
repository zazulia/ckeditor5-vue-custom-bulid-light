import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ImagePresetsCommand from './imagepresetscommand';

export default class ImagePresetsEditing extends Plugin {

	static get pluginName() {
		return 'ImagePresetsEditing';
	}

	init() {
		this._registerSchema();
		this._registerConverters();
        
		this.editor.commands.add('imagePresets', new ImagePresetsCommand(this.editor));
	}
    
	/**
	 * @private
	 */
	_registerSchema() {
		this.editor.model.schema.extend('image', {allowAttributes: ['preset', 'uuid', 'presets'] });
	}
    
    /**
	 * Registers image presets converters.
	 *
	 * @private
	 */
	_registerConverters() {
        
		const editor = this.editor;

		// Dedicated converter to propagate image's attribute to the img tag.
		editor.conversion.for('downcast').add( dispatcher =>
			dispatcher.on( 'attribute:preset:image', ( evt, data, conversionApi ) => {
                
				if (!conversionApi.consumable.consume( data.item, evt.name ) ) {
					return;
				}

				const viewWriter = conversionApi.writer;
				const figure = conversionApi.mapper.toViewElement( data.item );
                const img = figure.getChild(0);

				if (data.attributeNewValue !== null ) {
					viewWriter.setAttribute('preset', data.attributeNewValue, img);
				} else {
					viewWriter.removeAttribute('preset', img);
				}
			})
		);

		editor.conversion.for( 'upcast' )
			.attributeToAttribute( {
				view: 'preset',
				model: 'preset'
			} );
            
            
		editor.conversion.for('downcast').add( dispatcher =>
			dispatcher.on( 'attribute:uuid:image', ( evt, data, conversionApi ) => {
                
				if (!conversionApi.consumable.consume( data.item, evt.name ) ) {
					return;
				}

				const viewWriter = conversionApi.writer;
				const figure = conversionApi.mapper.toViewElement( data.item );
                const img = figure.getChild(0);

				if (data.attributeNewValue !== null ) {
					viewWriter.setAttribute('uuid', data.attributeNewValue, img);
				} else {
					viewWriter.removeAttribute('uuid', img);
				}
			})
		);

		editor.conversion.for( 'upcast' )
			.attributeToAttribute( {
				view: 'uuid',
				model: 'uuid'
			} );
            
            
		editor.conversion.for( 'upcast' )
			.attributeToAttribute( {
				view: {
					name: 'img',
					key: 'presets'
				},
				model: 'presets'
			} );
	}
}