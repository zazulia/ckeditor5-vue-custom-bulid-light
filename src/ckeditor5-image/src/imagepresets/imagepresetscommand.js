import Command from '@ckeditor/ckeditor5-core/src/command';
import { isImage } from '@ckeditor/ckeditor5-image/src/image/utils';

export default class ImagePresetsCommand extends Command {

	refresh() {
		const element = this.editor.model.document.selection.getSelectedElement();

		this.isEnabled = isImage( element );
        
        this.value = {};
        
        if (isImage(element)) {
            
            if (element.hasAttribute('src') ) {
                this.value['src'] = element.getAttribute('src');
            } else {
                this.value = null;
            }
            
            if (this.value && this.value.hasOwnProperty('src') && element.hasAttribute('preset') ) {
                this.value['preset'] = element.getAttribute('preset');
            } else {
                this.value = null;
            }
            
        } else {
            this.value = null;
        }
	}

	execute(options) {
		const model = this.editor.model;
		const imageElement = model.document.selection.getSelectedElement();

        if ( imageElement ) {
            model.change( writer => {
                
                if (options.newValue.hasOwnProperty('src')) {
                    writer.setAttribute('src', options.newValue.src, imageElement);
                }
                
                if (options.newValue.hasOwnProperty('preset')) {
                    writer.setAttribute('preset', options.newValue['preset'], imageElement);
                }
                
            });
        }
	}
}