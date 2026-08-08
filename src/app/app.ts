import { Component } from '@angular/core';
import { CanvasPreview } from './canvas/canvas-preview';

@Component({
  selector: 'app-root',
  imports: [CanvasPreview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
