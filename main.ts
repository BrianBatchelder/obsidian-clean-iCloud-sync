import { App, Modal, Plugin, Setting } from 'obsidian';

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
				const originalFile = matches[1] + matches[3]
				console.log("originalFile = " + originalFile)
				if (allFiles.filter(e => e.path === originalFile).length > 0) {
					if (file.path === originalFile) {
						console.log(file.path + " most likely represents original file for a sync conflict.");
					} else {
						console.log(file.path + " most likely represents a sync conflict.");
						var conflict = new Conflict([], false);
						if (conflicts.has(originalFile)) {
							conflict = conflicts.get(originalFile)!;
						}
						conflict.conflictingFiles.push(file.path);
						conflicts.set(originalFile, conflict);
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

		new SyncConflictModal(this.app, conflicts).open();
	}	
}

class Conflict {
	conflictingFiles:Array<string>;
	selected:boolean;

	constructor(conflictingFiles: Array<string>, selected: boolean) {
		this.conflictingFiles = conflictingFiles;
		this.selected = selected;
	}
}

class SyncConflictModal extends Modal {
	conflicts: Map<string, Conflict>;

	constructor(app: App, conflicts:Map<string, Conflict>) {
		super(app);
		this.conflicts = conflicts;
	}

	onOpen() {
		const {contentEl, titleEl} = this;

		titleEl.setText('iCloud Sync Conflicts');

		contentEl.createEl("p", { text: "Select which conflicts to clean." });

		this.conflicts.forEach((value, key) => {
			console.log("value: ", value +
				", key: ", key);

			new Setting(contentEl)
			.setName(key)
			.setDesc(value.conflictingFiles.join(", "))
			.addToggle((toggle) =>
					toggle
					.onChange(async (shouldClean) => {
						
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
					//   clean!
				}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
