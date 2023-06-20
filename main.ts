import { App, Modal, Plugin, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

export default class CleanICloudSyncPlugin extends Plugin {
	async onload() {
		// This adds a simple command that can be triggered from the palette
		this.addCommand({
			id: 'clean-icloud-sync-find-conflicts',
			name: 'Find iCloud sync conflicts',
			callback: () => {
				this.findConflictsInMarkdownFiles();
			}
		});
	}

	// onunload() {
	// }

	// async loadSettings() {
	// }

	// async saveSettings() {
	// }

	async findConflictsInMarkdownFiles() {
		let allFiles = this.app.vault.getMarkdownFiles().sort((a, b) => a.name.localeCompare(b.name))
		if (allFiles.length == 0) { return };

		const regex = /^(.*)( [0-9]+)(\.md)$/

		var conflicts = new Map<string, Conflict>();
		allFiles.forEach(function (file, index) { 
			const matches = regex.exec(file.path)
			if (matches) {
				console.log("Might have found sync conflict: " + matches[0])
				const originalFilePath = matches[1] + matches[3]
				console.log("originalFile = " + originalFilePath)
				const originalFiles = allFiles.filter(e => e.path === originalFilePath)
				if (originalFiles.length > 0) {
					const originalFile = originalFiles[0]!
					if (file.path === originalFile.path) {
						console.log(file.path + " most likely represents original file for a sync conflict.");
					} else {
						console.log(file.path + " most likely represents a sync conflict.");
						var conflict = new Conflict(file, [], false);
						if (conflicts.has(originalFilePath)) {
							conflict = conflicts.get(originalFilePath)!;
						}
						conflict.conflictingFiles.push(file);
						conflicts.set(originalFilePath, conflict);
					}
				} else {
					console.log(file.path + " does not represent a sync conflict.");
				}
				console.log(" ")
			}
		});

		conflicts.forEach((value, key) => {
			console.log("value: ", value +
				", key: ", key)
		})

		new FindConflictsModal(this.app, conflicts).open();
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

	constructor(app: App, conflicts:Map<string, Conflict>) {
		super(app);
		this.conflicts = conflicts;
	}

	onOpen() {
		const {contentEl, titleEl} = this;

		titleEl.setText('iCloud Sync Conflicts');

		contentEl.createEl("p", { text: "Select which conflicts to clean." });

		this.conflicts.forEach((conflict, key) => {
			console.log("key: ", key, "originalFile: ", conflict.originalFile, "conflictingFiles: ", conflict.conflictingFiles, "selected: ", conflict.selected );

			new Setting(contentEl)
			.setName(conflict.originalFile.path)
			.setDesc(conflict.conflictingFiles.map(({path}) => path).join(", "))
			.addToggle((toggle) =>
					toggle
					.onChange(async (shouldClean) => {
						conflict.selected = true
					})
				);
		})

		new Setting(contentEl)
		.addButton((btn) =>
		  	btn
				.setButtonText("Cancel")
				.onClick(() => {
					this.close();
				}))
		.addButton((btn) =>
		  	btn
				.setButtonText("Clean!")
				.setCta()
				.onClick(() => {
					this.close();

					// clean conflicts!
					new CleanConflictsModal(this.app, this.conflicts).open();		
				}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class CleanConflictsModal extends Modal {
	conflicts: Map<string, Conflict>;

	constructor(app: App, conflicts:Map<string, Conflict>) {
		super(app);
		this.conflicts = conflicts;
	}

	onOpen() {
		const {contentEl, titleEl} = this;

		titleEl.setText('Cleaning iCloud Sync Conflicts');

		this.conflicts.forEach((conflict, key) => {
			console.log("key: ", key, "originalFile: ", conflict.originalFile, "conflictingFiles: ", conflict.conflictingFiles, "selected: ", conflict.selected );

			if (conflict.selected) {
				console.log("BDB: cleaning: ", conflict.originalFile.path);
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
			console.log("BDB: original file: ", conflict.originalFile.path, "conflictingFiles: ", conflict.conflictingFiles, "selected: ", conflict.selected);
				// clean!
		});
	}

	private cleanConflict(conflict: Conflict) {
		const {contentEl} = this;

		// if content of files is identical, use original and move the others to the trash
		if (this.equalContent(conflict.originalFile, conflict.conflictingFiles)) {
			// move conflict.conflictingFiles to the trash
			conflict.conflictingFiles.forEach((file) => {
				console.log("BDB: deleting ", file.path);
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