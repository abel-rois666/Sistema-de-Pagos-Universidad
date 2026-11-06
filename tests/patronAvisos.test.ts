import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

test('la aplicación no incorpora alert, confirm o prompt nativos', () => {
  const errores: string[] = [];
  const recorrer = (directorio: string) => {
    for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
      const archivo = path.join(directorio, entrada.name);
      if (entrada.isDirectory()) { recorrer(archivo); continue; }
      if (!/\.tsx?$/.test(archivo)) continue;
      const fuente = ts.createSourceFile(archivo, fs.readFileSync(archivo, 'utf8'), ts.ScriptTarget.Latest, true, archivo.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visitar = (nodo: ts.Node) => {
        if (ts.isCallExpression(nodo)) {
          const expresion = nodo.expression;
          const nativo = ts.isIdentifier(expresion) && ['alert','confirm','prompt'].includes(expresion.text)
            || ts.isPropertyAccessExpression(expresion) && ['alert','confirm','prompt'].includes(expresion.name.text)
              && ['window','globalThis','self'].includes(expresion.expression.getText(fuente))
            || ts.isElementAccessExpression(expresion) && ['window','globalThis','self'].includes(expresion.expression.getText(fuente))
              && ts.isStringLiteral(expresion.argumentExpression) && ['alert','confirm','prompt'].includes(expresion.argumentExpression.text);
          if (nativo) errores.push(`${archivo}:${fuente.getLineAndCharacterOfPosition(nodo.getStart()).line + 1}`);
        }
        ts.forEachChild(nodo, visitar);
      };
      visitar(fuente);
    }
  };
  recorrer('src');
  assert.deepEqual(errores, [], `Usa toast o ModalConfirmacion: ${errores.join(', ')}`);
});
