'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import path = require('path');
import fs = require('fs');
import { AbstractProvider } from "./abstractProvider";

export class PascalReferenceProvider extends AbstractProvider implements vscode.ReferenceProvider {

	private parseReferenceLocation(output: string, filename: string): vscode.Location[] {

		var items: vscode.Location[] = new Array<vscode.Location>();
		output.split(/\r?\n/)
			.forEach(function (value, index, array) {

				if (value != null && value != "") {

					let values = value.split(/ +/);

					// Create           2583 DelphiAST.pas      Result := FStack.Peek.AddChild(TSyntaxNode.Create(Typ));
					let word = values.shift();
					let line = parseInt(values.shift()) - 1;

					let filePath: string;
					let rest: string = values.join(' ');
					let idxProc = rest.match(/(\w|\s)+.pas\s+/gi);

					filePath = rest.substr(0, rest.indexOf(idxProc[ 0 ]) + idxProc[ 0 ].length - 1)
					filePath = path.join(AbstractProvider.basePathForFilename(filename), filePath);

					let definition = new vscode.Location(
						vscode.Uri.file(filePath), new vscode.Position(line, 0)
					);

					items.push(definition);
				}

			});

		return items;
	}

	private referenceLocations(word: string, filename: string): Promise<vscode.Location[]> {

		return new Promise<vscode.Location[]>((resolve, reject) => {

			this.generateTagsIfNeeded(filename)
				.then((value: boolean) => {
					if (value) {
						let p = cp.execFile('global', [ '-rx', word ], { cwd: AbstractProvider.basePathForFilename(filename) }, (err, stdout, stderr) => {
							try {
								if (err && (<any>err).code === 'ENOENT') {
									console.log('The "global" command is not available. Make sure it is on PATH');
								}
								if (err) return resolve(null);
								let result = stdout.toString();
								// console.log(result);
								let locs = <vscode.Location[]>this.parseReferenceLocation(result, filename);
								return resolve(locs);
							} catch (e) {
								reject(e);
							}
						});
					} else {
						return resolve (null);
					}
				});
		});
	}

	public provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> {
		let fileName: string = document.fileName;
		let word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
		return this.referenceLocations(word, fileName).then(locs => {
			return locs;
		});
	}
}
