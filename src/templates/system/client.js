class ReconnectionManager {
    constructor() {
        this.overlay = this.createOverlay();
        this.checkInterval = null;
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            color: white;
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: system-ui;
        `;
        overlay.innerHTML = `
            <div style="text-align: center">
                <h2>System Updating...</h2>
                <p>Reconnecting to server...</p>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/things');
            if (response.ok) {
                this.hide();
                location.reload(); // Refresh to get new code
                return true;
            }
        } catch (e) {
            return false;
        }
    }

    show() {
        this.overlay.style.display = 'flex';
        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.checkConnection(), 500);
        }
    }

    hide() {
        this.overlay.style.display = 'none';
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

class ThingEditor {
  constructor(containerId) {
      this.container = document.getElementById(containerId);
      this.currentThing = null;
      this.editors = {};
      this.setupEventListeners();
      this.render();
      this.loadThingList();
      this.reconnectionManager = new ReconnectionManager();
      this.setupConnectionMonitoring();
  }

  setupEventListeners() {
      const thingSelector = document.getElementById('thing-selector');
      const versionSelector = document.getElementById('version-selector');

      thingSelector.addEventListener('change', (e) => {
          if (e.target.value === 'new') {
              this.createNewThing();
          } else if (e.target.value) {
              this.loadThing(e.target.value);
          }
      });

      versionSelector.addEventListener('change', (e) => {
          if (e.target.value) {
              this.previewVersion(parseInt(e.target.value));
          }
      });
  }

  render() {
      this.container.innerHTML = 
          '<div class="editor">' +
              '<div class="editor-section">' +
                  '<h3>HTML</h3>' +
                  '<textarea id="html-editor"></textarea>' +
              '</div>' +
              '<div class="editor-section">' +
                  '<h3>CSS</h3>' +
                  '<textarea id="css-editor"></textarea>' +
              '</div>' +
              '<div class="editor-section">' +
                  '<h3>Client JS</h3>' +
                  '<textarea id="js-editor"></textarea>' +
              '</div>' +
              '<div class="editor-section">' +
                  '<h3>Server JS</h3>' +
                  '<textarea id="server-js-editor"></textarea>' +
              '</div>' +
              '<div class="actions">' +
                  '<button onclick="editor.saveThing()">Save</button>' +
              '</div>' +
          '</div>';

      this.editors.html = CodeMirror.fromTextArea(
          document.getElementById('html-editor'),
          {
              mode: 'htmlmixed',
              theme: 'monokai',
              lineNumbers: true,
              autoCloseTags: true,
              autoCloseBrackets: true,
              tabSize: 2
          }
      );

      this.editors.css = CodeMirror.fromTextArea(
          document.getElementById('css-editor'),
          {
              mode: 'css',
              theme: 'monokai',
              lineNumbers: true,
              autoCloseBrackets: true,
              tabSize: 2
          }
      );

      this.editors.js = CodeMirror.fromTextArea(
          document.getElementById('js-editor'),
          {
              mode: 'javascript',
              theme: 'monokai',
              lineNumbers: true,
              autoCloseBrackets: true,
              tabSize: 2
          }
      );

      this.editors.serverJs = CodeMirror.fromTextArea(
          document.getElementById('server-js-editor'),
          {
              mode: 'javascript',
              theme: 'monokai',
              lineNumbers: true,
              autoCloseBrackets: true,
              tabSize: 2
          }
      );

      ['html', 'css', 'js'].forEach(type => {
          this.editors[type].on('change', () => this.updatePreview());
      });
  }

  async loadThingList() {
      const response = await fetch('/api/things');
      const things = await response.json();
      
      const selector = document.getElementById('thing-selector');
      selector.options.length = 2;
      
      things.forEach(thing => {
          const option = new Option(thing.name, thing.id);
          selector.add(option);
      });
  }

  async loadThing(id) {
      const response = await fetch('/api/things/' + id);
      this.currentThing = await response.json();
      
      this.editors.html.setValue(this.currentThing.components.html);
      this.editors.css.setValue(this.currentThing.components.css);
      this.editors.js.setValue(this.currentThing.components.clientJs);
      this.editors.serverJs.setValue(this.currentThing.components.serverJs);

      document.title = 'Thing System - Editing: ' + this.currentThing.name;
      document.getElementById('current-version').textContent = 
          'Current: v' + this.currentThing.version;

      this.updateVersionSelector(this.currentThing);
      this.updatePreview();
  }

  async createNewThing() {
      const name = prompt('Enter name for new Thing:');
      if (!name) return;
      
      const response = await fetch('/api/things', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
      });
      
      const newThing = await response.json();
      await this.loadThingList();
      document.getElementById('thing-selector').value = newThing.id;
      this.loadThing(newThing.id);
  }

  async saveThing() {
      if (!this.currentThing) return;

      const updates = {
          components: {
              html: this.editors.html.getValue(),
              css: this.editors.css.getValue(),
              clientJs: this.editors.js.getValue(),
              serverJs: this.editors.serverJs.getValue()
          }
      };
      
      const response = await fetch('/api/things/' + this.currentThing.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
      });

      const updatedThing = await response.json();
      document.getElementById('current-version').textContent = 
          'Current: v' + updatedThing.version;
      
      this.updateVersionSelector(updatedThing);
      alert('Thing saved!');
      
      if (this.currentThing.id === window.SYSTEM_THING_ID) {
          location.reload();
      } else {
          this.currentThing = updatedThing;
      }
  }

  updatePreview() {
      if (!this.currentThing) return;
      
      const previewContainer = document.getElementById('preview-container');
      if (!previewContainer) return;

      const html = this.editors.html.getValue();
      const css = this.editors.css.getValue();
      const js = this.editors.js.getValue();

      if (this.currentThing.id === window.SYSTEM_THING_ID) {
          previewContainer.innerHTML = 
              '<style>' +
              '.preview-content { transform: scale(0.7); transform-origin: top left; }' +
              css +
              '</style>' +
              '<div class="preview-content">' + html + '</div>';
          return;
      }

      previewContainer.innerHTML = 
          '<style>' +
          '#preview-container { ' +
              'padding: 20px; ' +
              'height: 100%; ' +
              'display: flex; ' +
              'flex-direction: column; ' +
          '}' +
          '.preview-content { ' +
              'flex: 1; ' +
              'display: flex; ' +
              'flex-direction: column; ' +
              'min-height: 100%; ' +
          '}' +
          '.preview-content { ' + css + ' }' +
          '</style>' +
          '<div class="preview-content">' + html + '</div>' +
          '<script>' +
          '(function() {' +
              'try {' +
                  js +
              '} catch (e) {' +
                  'console.error("Preview JS Error:", e);' +
              '}' +
          '})();' +
          '</script>';
  }

  updateVersionSelector(thing) {
      const versionSelector = document.getElementById('version-selector');
      const versionDisplay = document.getElementById('current-version');
      versionSelector.style.display = 'block';
      versionSelector.options.length = 1;
      
      // Add restore button if not showing current version
      const restoreBtn = document.getElementById('restore-version-btn') || (() => {
          const btn = document.createElement('button');
          btn.id = 'restore-version-btn';
          btn.style.display = 'none';
          btn.textContent = 'Restore This Version';
          btn.onclick = () => this.restoreVersion(parseInt(versionSelector.value));
          versionDisplay.parentNode.appendChild(btn);
          return btn;
      })();
      
      const sortedHistory = [...thing.history].sort((a, b) => b.version - a.version);
      
      sortedHistory.forEach(hist => {
          versionSelector.add(new Option(
              'Version ' + hist.version + ' (' + new Date(hist.timestamp).toLocaleString() + ')',
              hist.version
          ));
      });
  }

  async previewVersion(version) {
      if (!this.currentThing) return;
      
      // Find the version in history
      const historyItem = this.currentThing.history.find(h => h.version === version);
      if (!historyItem) return;

      // Update editors with historical content
      this.editors.html.setValue(historyItem.components.html);
      this.editors.css.setValue(historyItem.components.css);
      this.editors.js.setValue(historyItem.components.clientJs);
      this.editors.serverJs.setValue(historyItem.components.serverJs);

      // Show restore button
      const restoreBtn = document.getElementById('restore-version-btn');
      if (restoreBtn) {
          restoreBtn.style.display = version === this.currentThing.version ? 'none' : 'inline';
      }
  }

  async restoreVersion(version) {
      if (!this.currentThing || !confirm('Are you sure you want to restore this version?')) return;

      await fetch('/api/things/' + this.currentThing.id + '/restore/' + version, {
          method: 'POST'
      });

      if (this.currentThing.id === window.SYSTEM_THING_ID) {
          location.reload();
      } else {
          this.loadThing(this.currentThing.id);
      }
  }

  setupConnectionMonitoring() {
      let failedRequests = 0;
      
      // Intercept all fetch requests
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
          try {
              const response = await originalFetch(...args);
              failedRequests = 0; // Reset on success
              return response;
          } catch (error) {
              failedRequests++;
              if (failedRequests >= 2) { // Show overlay after 2 failed requests
                  this.reconnectionManager.show();
              }
              throw error;
          }
      };
  }
}

const editor = new ThingEditor('editor');