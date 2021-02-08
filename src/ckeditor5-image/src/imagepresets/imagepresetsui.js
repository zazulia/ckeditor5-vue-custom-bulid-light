
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import SimpleUploadAdapter from '../../../ckeditor5-upload/src/adapters/simpleuploadadapter.js';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import clickOutsideHandler from '@ckeditor/ckeditor5-ui/src/bindings/clickoutsidehandler';
import ImagePresetsFormView from './ui/imagepresetsformview';
import ImagePresetsNotificationFormView from './ui/imagepresetsnotificationformview';
import ContextualBalloon from '@ckeditor/ckeditor5-ui/src/panel/balloon/contextualballoon';
import presetsIcon from '@ckeditor/ckeditor5-core/theme/icons/object-size-large.svg';
import presetsCodeIcon from '@ckeditor/ckeditor5-basic-styles/theme/icons/code.svg';
import { repositionContextualBalloon, getBalloonPositionData } from '@ckeditor/ckeditor5-image/src/image/ui/utils';
import { getSelectedImageWidget } from '@ckeditor/ckeditor5-image/src/image/utils.js';
import { isImage } from '@ckeditor/ckeditor5-image/src/image/utils';


export default class ImagePresetsUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ContextualBalloon, SimpleUploadAdapter ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'ImagePresetsUI';
	}

	/**
	 * @inheritDoc
	 */
	init() {
        this.presetsOptions = [];
        this.configSimpleUpload = this.editor.config.get('simpleUpload');
        this.xhrPresets = null;
        this.xhrLoad = null;
        
        
		this._createButton();
        this._createButtonCopyShortcode();
		this._createForm();
		this._createFormNotification();
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		super.destroy();
        
        if (this.xhrPresets) {
            this.xhrPresets.abort();
            this.xhrLoad = null;
        }
        
        if (this.xhrLoad) {
            this.xhrLoad.abort();
            this.xhrLoad = null;
        }
        

		// Destroy created UI components as they are not automatically destroyed (see ckeditor5#1341).
		this._form.destroy();
	}

	_createButton() {
		const editor = this.editor;
		const t = editor.t;

		editor.ui.componentFactory.add('imagePresets', locale => {
			const command = editor.commands.get('imagePresets');
			const view = new ButtonView(locale);

			view.set( {
				label: t( 'Change image presets' ),
				icon: presetsIcon,
				tooltip: true
			} );

			// view.bind('isEnabled').to(command, 'isEnabled');
			view.bind('isEnabled').to(command, 'isEnabled', this, 'isEnabled', ( isCommandEnabled, isPluginVisible ) => isCommandEnabled && isPluginVisible);

			this.listenTo( view, 'execute', () => {
				this._showForm();
			} );

			return view;
		} );
	}
    
	_createButtonCopyShortcode() {
		const editor = this.editor;
		const t = editor.t;

		editor.ui.componentFactory.add('imagePresets:copy', locale => {
			const command = editor.commands.get('imagePresets');
			const view = new ButtonView(locale);

			view.set( {
				label: t("Copy image preset's shortcode"),
				icon: presetsCodeIcon,
				tooltip: true
			} );

			view.bind('isEnabled').to(command, 'isEnabled', this, 'isEnabled', ( isCommandEnabled, isPluginVisible ) => isCommandEnabled && isPluginVisible);

			this.listenTo( view, 'execute', () => {
                this._showFormNotification();
			} );

			return view;
		} );
	}


	_createForm() {
        let _this = this;
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;
        
		this._balloon = this.editor.plugins.get('ContextualBalloon');

		this._form = new ImagePresetsFormView( editor.locale );

		// Render the form so its #element is available for clickOutsideHandler.
		this._form.render();

		/*this.listenTo( this._form, 'submit', () => {
			editor.execute('imagePresets', {
				newValue: this._form.labeledInput.fieldView.element.value
			} );

			this._hideForm( true );
		} );*/

		this.listenTo( this._form, 'cancel', () => {
			this._hideForm( true );
		} );
        
        this.listenTo(this._form, 'presetExecute', ( evt, data ) => {
            
            const element = this.editor.model.document.selection.getSelectedElement();
            const ViewFigure = this.editor.editing.mapper.toViewElement(element);
                            
            if (isImage(element) && ViewFigure.hasOwnProperty('name') && ViewFigure.name === 'figure') {
                const ViewImg = ViewFigure.getChild(0);
                
                if (ViewImg.hasOwnProperty('name') && ViewImg.name === 'img') {
                    let presets = ViewImg.getCustomProperty('presets');
                                    
                    if (presets !== undefined) {
                                                
                        editor.execute('imagePresets', {
                            newValue: {src: this.getOptionPreset(presets, evt.source.label), 'preset': evt.source.label}
                        });
                        
                    }
                }
            }

			this._hideForm(true);
        } );
        

		// Close the form on Esc key press.
		this._form.keystrokes.set( 'Esc', ( data, cancel ) => {
			this._hideForm( true );
			cancel();
		} );

		// Reposition the balloon or hide the form if an image widget is no longer selected.
		this.listenTo( editor.ui, 'update', () => {
			if ( !getSelectedImageWidget( viewDocument.selection ) ) {
				this._hideForm( true );
			} else if ( this._isVisible ) {
				repositionContextualBalloon( editor );
			}
		} );

		// Close on click outside of balloon panel element.
		clickOutsideHandler( {
			emitter: this._form,
			activator: () => this._isVisible,
			contextElements: [ this._balloon.view.element ],
			callback: () => this._hideForm()
		} );
	}


	_showForm() {
        let _this = this;
        
		if ( this._isVisible ) {
			return;
		}

		const editor = this.editor;
		const command = editor.commands.get('imagePresets');
		const optionButtons = this._form.optionButtons;
        
		const element = this.editor.model.document.selection.getSelectedElement();
        const ViewFigure = this.editor.editing.mapper.toViewElement(element);
                        
        if (isImage(element) && ViewFigure.hasOwnProperty('name') && ViewFigure.name === 'figure') {
            const ViewImg = ViewFigure.getChild(0);
                        
            if (ViewImg.hasOwnProperty('name') && ViewImg.name === 'img') {
                let presets = ViewImg.getCustomProperty('presets');
                let attrUuid = ViewImg.getAttribute('uuid');
                                
                if (presets !== undefined && presets.length) {
                    
                    for (let i in presets) {
                        if (i < optionButtons.length) {
                            optionButtons[i].label = presets[i].name;
                            optionButtons[i].isVisible = true;
                        }
                    }
                }
                
                if ((presets === undefined || !presets.length) && attrUuid !== undefined) {

                    this.xhrPresets = new XMLHttpRequest();
                    this.xhrLoad = new XMLHttpRequest();
                    
                    _this._sendRequestPresets(function(data) {
                        
                        let viewImgUuid = ViewImg.getAttribute('uuid');
                        
                        let { presetsOptions = [], uuid = '' } = data || {};
                                                
                        if (presetsOptions.length && uuid === viewImgUuid) {                            

                            for (let i in presetsOptions) {
                                if (i < optionButtons.length) {
                                    optionButtons[i].label = presetsOptions[i].name;
                                    optionButtons[i].isVisible = true;
                                }
                            }
                                                        
                            ViewImg._customProperties.set('presets', presetsOptions);
                        }
                        
                    }, function() {
                        
                        console.log('second func');
                    }, attrUuid);
                }
            }
        }

		if ( !this._isInBalloon ) {
			this._balloon.add( {
				view: this._form,
				position: getBalloonPositionData( editor )
			} );
		}        
	}

	_hideForm( focusEditable ) {
		if ( !this._isInBalloon ) {
			return;
		}
        
        if (this.xhrPresets) {
            this.xhrPresets.abort();
            this.xhrLoad = null;
        }
        
        if (this.xhrLoad) {
            this.xhrLoad.abort();
            this.xhrLoad = null;
        }
        
        const optionButtons = this._form.optionButtons;
        
        for (let i in optionButtons) {
            optionButtons[i].label = '';
            optionButtons[i].isVisible = false;
        }

		// Blur the input element before removing it from DOM to prevent issues in some browsers.
		// See https://github.com/ckeditor/ckeditor5/issues/1501.
		if ( this._form.focusTracker.isFocused ) {
			this._form.saveButtonView.focus();
		}

		this._balloon.remove( this._form );

		if ( focusEditable ) {
			this.editor.editing.view.focus();
		}
	}
    
    _createFormNotification() {
        let _this = this;
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;
        
		this._balloonNotify = editor.plugins.get('ContextualBalloon');
        
        this._notify = new ImagePresetsNotificationFormView(editor.locale);
		this._notify.render();
        this._notifyTimeoutID = null;
        
		// Close the form on Esc key press.
		this._notify.keystrokes.set( 'Esc', ( data, cancel ) => {
            if(_this._notifyTimeoutID) {
                clearTimeout(_this._notifyTimeoutID);
            }
			this._hideFormNotification( true );
			cancel();
		} );

		// Reposition the balloon or hide the form if an image widget is no longer selected.
		this.listenTo( editor.ui, 'update', () => {
			if ( !getSelectedImageWidget( viewDocument.selection ) ) {
                if(_this._notifyTimeoutID) {
                    clearTimeout(_this._notifyTimeoutID);
                }
				this._hideFormNotification( true );
			} else if ( this._isVisibleNotification ) {
				repositionContextualBalloon( editor );
			}
		} );

		// Close on click outside of balloon panel element.
		clickOutsideHandler( {
			emitter: this._notify,
			activator: () => this._isVisibleNotification,
			contextElements: [ this._balloonNotify.view.element ],
			callback: function() {
                if(_this._notifyTimeoutID) {
                    clearTimeout(_this._notifyTimeoutID);
                }
                _this._hideFormNotification()
            }
		} );
    }
    
    
	_showFormNotification() {
        let _this = this;
        
		if ( this._isVisibleNotification ) {
			return;
		}

		const editor = this.editor;
        
		const element = editor.model.document.selection.getSelectedElement();
        const ViewFigure = editor.editing.mapper.toViewElement(element);
        
		const t = editor.locale.t;
                
        if (isImage(element) && ViewFigure.hasOwnProperty('name') && ViewFigure.name === 'figure') {
            const ViewImg = ViewFigure.getChild(0);
                        
            if (ViewImg.hasOwnProperty('name') && ViewImg.name === 'img') {
                
                let attrUuid = ViewImg.getAttribute('uuid');
                let attrPreset = ViewImg.getAttribute('preset');
                
                if (attrUuid && attrPreset) {
                
                    try {
                        let shortcode = '[file:' + attrUuid + ':' + attrPreset + ']';
                        this._copyToClipboard(shortcode);
                        
                        this._notify.textView.text = t('Image\'s preset shortcode was copied in buffer');
                        
                        
                    } catch(err) {                   
                        this._notify.textView.text = t('Can`t copy image\'s preset shortcode');
                    }
                
                } else {
                    this._notify.textView.text = t('Can`t copy image\'s preset shortcode');
                }
                
            }
        }
        
        this._notifyTimeoutID = setTimeout(() => {
            if (!this._isVisibleNotification ) {
                
                if(this._notifyTimeoutID) {
                    clearTimeout(this._notifyTimeoutID);
                }
                
                return;
            }
            this._hideFormNotification();            
        }, 1500);
        

		if ( !this._isInBalloonNotification ) {            
			this._balloonNotify.add( {
				view: this._notify,
				position: getBalloonPositionData( editor )
			} );
		}        
	}
    
    _copyToClipboard(str) {
        const el = document.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        const selected = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : false;
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        if (selected) {
            document.getSelection().removeAllRanges();
            document.getSelection().addRange(selected);
        }
    }
    

	_hideFormNotification(focusEditable ) {
		if ( !this._isInBalloonNotification ) {
			return;
		}
        
        const textView = this._notify.textView;
        textView.text = '';
        
        if(this._notifyTimeoutID) {
            clearTimeout(this._notifyTimeoutID);
        }

		this._balloonNotify.remove(this._notify);

		if ( focusEditable ) {
			this.editor.editing.view.focus();
		}
	}
    
    
    callbackPromise(resolve, reject, uuid, presetsArr) {
        
        if (presetsArr.length) {
            this._sendRequestLoad(resolve, reject, uuid, presetsArr);
        } else {
            reject();
        }
    }
    
    
    _initListenersPresets(resolve, reject, uuid) {
        
        let _this = this;
        let presetsArr = [];

        this.xhrPresets.addEventListener('error', function() {
            _this.callbackPromise(resolve, reject, uuid, presetsArr);
        });
        
        this.xhrPresets.addEventListener('abort', function() {
            _this.callbackPromise(resolve, reject, uuid, presetsArr);
        });
        
        this.xhrPresets.addEventListener('load', () => {
                        
            let response = JSON.parse(_this.xhrPresets.response);      
                  
            if (_this.xhrPresets.response && response.hasOwnProperty('data') && response.data.hasOwnProperty('presets')) {
                
                let presets = response.data.presets;
                                  
                for (let index in presets) {
                    
                    presetsArr.push(presets[index].id);
                }
            }
            
            _this.callbackPromise(resolve, reject, uuid, presetsArr);
        });
    }
    
    _sendRequestPresets(resolve, reject, uuid) {
        
        this._initListenersPresets(resolve, reject, uuid);
                
        this.xhrPresets.open('GET', this.configSimpleUpload.presetUrl ? this.configSimpleUpload.presetUrl : '', true);
                
        // Set headers if specified.
        const headers = this.configSimpleUpload.headers || {};

        // Use the withCredentials flag if specified.
        const withCredentials = this.configSimpleUpload.withCredentials || false;

        Object.keys(headers).forEach((headerName) => {
            this.xhrPresets.setRequestHeader(headerName, headers[headerName]);
        });

        this.xhrPresets.withCredentials = withCredentials;

        // Send the request.
        this.xhrPresets.send();
    }
    
    _initListenersLoad(resolve, reject, uuid, presets) {
        let _this = this;

        this.xhrLoad.addEventListener('error', reject);
        
        this.xhrLoad.addEventListener('abort', reject);
        
        this.xhrLoad.addEventListener('load', () => {
            const response = JSON.parse(_this.xhrLoad.response);

            if (!_this.xhrLoad.response || (response.hasOwnProperty('status') && (response.status === 'ERROR' || response.status === 'EXEPTION'))) {
                return reject();
            }
            
            if (response.hasOwnProperty('data') && response.data.hasOwnProperty('files')) {
                                
                let files = response.data.files;
                let urls = [];
                let presetsToolbar = [];
                let presetsToolbarMap = {};
                
                for (let index in files) {
                    
                    for (let indexPreset in presets) {
                        
                        let linkStr = _this.getLink(files[index][presets[indexPreset]].links);
                        urls.push(linkStr);
                        
                        presetsToolbar.push({
                            name: presets[indexPreset],
                            value: linkStr,
                            icon: ''
                        });
                        
                        presetsToolbarMap[presets[indexPreset]] = {
                            name: presets[indexPreset],
                            value: linkStr,
                            icon: ''
                        }
                    }
                }
                
                let currentPreset = '';
                
                if (urls.length) {
                    if (presetsToolbarMap.hasOwnProperty('large')) {
                        currentPreset = 'large';
                    } else {
                        currentPreset = presets[0];
                    }
                }
                
                if (urls.length) {
                    
                    if(presetsToolbarMap.hasOwnProperty('large')) {
                        
                        resolve({uuid: uuid, preset: currentPreset, presetsOptions: presetsToolbar});

                    } else {
                        
                        resolve({uuid: uuid, preset: currentPreset, presetsOptions: presetsToolbar});
                        
                    }
                } else {
                    reject();
                }
                
            } else {
                reject();
            }
        });

        // Upload progress when it is supported.
        /* istanbul ignore else */
        if (this.xhrLoad.upload) {
            this.xhrLoad.upload.addEventListener('progress', evt => {
                if (evt.lengthComputable) {
                    loader.uploadTotal = evt.total;
                    loader.uploaded = evt.loaded;
                }
            });
        }
    }
    
    _sendRequestLoad(resolve, reject, uuid, presets) {
        
        this._initListenersLoad(resolve, reject, uuid, presets);
        
        const data = this._createFormLoad(uuid, this.configSimpleUpload, presets);
                
        this.xhrLoad.open('GET', this.configSimpleUpload.loadUrl + '?' + this._getQueryString(data), true);
                
        // Set headers if specified.
        const headers = this.configSimpleUpload.headers || {};

        // Use the withCredentials flag if specified.
        const withCredentials = this.configSimpleUpload.withCredentials || false;

        Object.keys(headers).forEach((headerName) => {
            this.xhrLoad.setRequestHeader(headerName, headers[headerName]);
        });

        this.xhrLoad.withCredentials = withCredentials;

        // Send the request.
        this.xhrLoad.send(data);
    }
    
    
    _getQueryArray(obj, path = [], result = []) {
        let _this = this;
        
        return Object.entries(obj).reduce((acc, [ k, v ]) => {
            path.push(k);

            if (v instanceof Object) {
                _this._getQueryArray(v, path, acc);
            } else {
                acc.push(`${path.map((n, i) => i ? `[${n}]` : n).join('')}=${v}`);
            }

            path.pop();

            return acc;
        }, result);
    }
    
    _getQueryString(obj) {
        return this._getQueryArray(obj).join('&');
    }
    
    _createFormLoad(uuid, opts, presets) {
        
        const data = {};
        
        data.files = [uuid];
        data.fileinfo = opts.fileInfo ? opts.fileInfo : false;
        data.presets = presets.length ? presets : [];

        
        return data;
    }
    
    getLink(links) {
        let str = '';

        if (!this.isEmptyObject(links)) {
            let keys = Object.keys(links);

            if (keys.length === 1) {
                str = links['fallback'];
            } else {
                for (let i in links) {
                    if (i !== 'fallback') {
                        return links[i];
                        break;
                    }
                }
            }
        }

        return str;
    }
    
    isEmptyObject(obj) {
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                return false;
            }
        }
        return true;
    }
    
    getOptionPreset(presets, name) {
        for (let i in presets) {
            if (presets[i].name === name) {
                return presets[i].value;
            }
        }
        
        return '';
    }

	get _isVisible() {
		return this._balloon.visibleView === this._form;
	}


	get _isInBalloon() {
		return this._balloon.hasView( this._form );
	}
    
    
	get _isVisibleNotification() {
		return this._balloonNotify.visibleView === this._notify;
	}


	get _isInBalloonNotification() {
		return this._balloonNotify.hasView( this._notify );
	}
}