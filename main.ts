import { App, Modal, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

interface CleanICloudSyncSettings {
	debug: boolean;
}

const DEFAULT_SETTINGS: CleanICloudSyncSettings = {
	debug: false
}

function debugLog(debug: boolean, message: string) {
	if (debug) {
		console.log("BDB: " + message)
	}
}

export default class CleanICloudSyncPlugin extends Plugin {
	settings: CleanICloudSyncSettings;

	async onload() {
		await this.loadSettings()

		// This adds a simple command that can be triggered from the palette
		this.addCommand({
			id: 'clean-icloud-sync-find-conflicts',
			name: 'Find iCloud sync conflicts',
			callback: () => {
				this.findConflictsInMarkdownFiles();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CleanICloudSyncSettingTab(this.app, this));

	}

	// onunload() {
	// }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async findConflictsInMarkdownFiles() {
		const debug = this.settings.debug;

		let allFiles = this.app.vault.getMarkdownFiles().sort((a, b) => a.name.localeCompare(b.name))
		debugLog(debug, "# of files = " + allFiles.length)
		if (allFiles.length == 0) { return };

		const regex = /^(.*)( [0-9]+)(\.md)$/

		var conflicts = new Map<string, Conflict>();
		allFiles.forEach(function (file, index) {
			const matches = regex.exec(file.path)
			if (matches) {
				debugLog(debug, "Might have found sync conflict: " + matches[0])
				const originalFilePath = matches[1] + matches[3]
				debugLog(debug, "originalFile = " + originalFilePath)
				const originalFiles = allFiles.filter(e => e.path === originalFilePath)
				if (originalFiles.length > 0) {
					const originalFile = originalFiles[0]!
					if (file.path === originalFile.path) {
						debugLog(debug, file.path + " most likely represents original file for a sync conflict.");
					} else {
						debugLog(debug, file.path + " most likely represents a sync conflict.");
						var conflict = new Conflict(file, [], false);
						if (conflicts.has(originalFilePath)) {
							conflict = conflicts.get(originalFilePath)!;
						}
						conflict.conflictingFiles.push(file);
						conflicts.set(originalFilePath, conflict);
					}
				} else {
					debugLog(debug, file.path + " does not represent a sync conflict.");
				}
				debugLog(debug, " ")
			}
		});

		debugLog(debug, "# of conflicts = " + conflicts.size)

		conflicts.forEach((value, key) => {
			debugLog(debug, "value: " + value +
				", key: " + key)
		})

		new FindConflictsModal(this.app, conflicts, debug).open();
	}	
}

class Conflict {
	originalFile: TFile;
	conflictingFiles: Array<TFile>;
	selected: boolean;

	constructor(originalFile: TFile, conflictingFiles: Array<TFile>, selected: boolean) {
		this.originalFile = originalFile;
		this.conflictingFiles = conflictingFiles;
		this.selected = selected;
	}
}

class FindConflictsModal extends Modal {
	conflicts: Map<string, Conflict>;
	debug: boolean;

	constructor(app: App, conflicts: Map<string, Conflict>, debug: boolean) {
		super(app);
		this.conflicts = conflicts;
		this.debug = debug;
	}

	onOpen() {
		const {contentEl, titleEl} = this;

		titleEl.setText('iCloud Sync Conflicts');

		if (this.conflicts.size == 0) { 
			contentEl.createEl("p", { text: "No conflicts found." });
		} else {
			contentEl.createEl("p", { text: "Select which conflicts to clean." });

			this.conflicts.forEach((conflict, key) => {
				debugLog(this.debug, "key: " + key + "originalFile: " + conflict.originalFile + "conflictingFiles: " + conflict.conflictingFiles + "selected: " + conflict.selected );

				new Setting(contentEl)
				.setName(conflict.originalFile.path)
				.setDesc(conflict.conflictingFiles.map(({path}) => path).join(", "))
				.addToggle((toggle) =>
						toggle
						.onChange(async (shouldClean) => {
							conflict.selected = shouldClean
						})
					);
			})
		}

		var buttons = new Setting(contentEl);
		if (this.conflicts.size > 0) { 
			buttons.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
					}))
		}
		buttons.addButton((btn) =>
		  	btn
				.setButtonText((this.conflicts.size == 0) ? "Done" : "Clean!")
				.setCta()
				.onClick(() => {
					this.close();

					if (this.conflicts.size > 0) {
						// clean conflicts!
						new CleanConflictsModal(this.app, this.conflicts, this.debug).open();	
					}	
				}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class CleanConflictsModal extends Modal {
	conflicts: Map<string, Conflict>;
	debug: boolean;

	constructor(app: App, conflicts:Map<string, Conflict>, debug: boolean) {
		super(app);
		this.conflicts = conflicts;
		this.debug = debug;
	}

	onOpen() {
		const {contentEl, titleEl} = this;

		titleEl.setText('Cleaning iCloud Sync Conflicts');

		this.conflicts.forEach((conflict, key) => {
			debugLog(this.debug, "key: " + key + "originalFile: " + conflict.originalFile + "conflictingFiles: " + conflict.conflictingFiles + "selected: " + conflict.selected );

			if (conflict.selected) {
				debugLog(this.debug, "cleaning: " + conflict.originalFile.path);
				contentEl.createEl("p", { text: "Cleaning " + conflict.originalFile.path + "..." });
				this.cleanConflict(conflict);
			} else {
				contentEl.createEl("p", { text: "Skipping " + conflict.originalFile.path + "." });
			}

			// new Setting(contentEl)
			// .setName(conflict.originalFile.path)
			// .setDesc(conflict.conflictingFiles.map(({path}) => path).join(", "))
			// .addToggle((toggle) =>
			// 		toggle
			// 		.onChange(async (shouldClean) => {
			// 			conflict.selected = true
			// 		})
			// 	);
		})

		new Setting(contentEl)
		// .addButton((btn) =>
		//   	btn
		// 		.setButtonText("Cancel")
		// 		.onClick(() => {
		// 			this.close();
		// 		}))
		.addButton((btn) =>
		  	btn
				.setButtonText("Done")
				.setCta()
				.onClick(() => {
					this.close();		
				}));
	}

	private cleanConflicts() {
		// process user selections
		this.conflicts.forEach((conflict, key) => {
			debugLog(this.debug, "original file: " + conflict.originalFile.path + "conflictingFiles: " + conflict.conflictingFiles + "selected: " + conflict.selected);
				// clean!
		});
	}

	private cleanConflict(conflict: Conflict) {
		const {contentEl} = this;

		// if content of files is identical, use original and move the others to the trash
		if (this.equalContent(conflict.originalFile, conflict.conflictingFiles)) {
			// move conflict.conflictingFiles to the trash
			conflict.conflictingFiles.forEach((file) => {
				debugLog(this.debug, "Deleting " + file.path);
				contentEl.createEl("p", { text: "Deleting " + file.path + "..." });
				app.vault.delete(file);
			});
		}
	}

	equalContent(originalFile: TFile, conflictingFiles: Array<TFile>): boolean {
		return false
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class CleanICloudSyncSettingTab extends PluginSettingTab {
	plugin: CleanICloudSyncPlugin;

	constructor(app: App, plugin: CleanICloudSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Clean iCloud Sync plugin.'});

		new Setting(containerEl)
			.setName('Debug')
			.setDesc('Debug Mode')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debug)
					.onChange(async (debug) => {
						this.plugin.settings.debug = debug
						await this.plugin.saveSettings();
					})
			);
	}
}