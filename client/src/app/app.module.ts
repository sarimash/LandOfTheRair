import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';

import { NgxsReduxDevtoolsPluginModule } from '@ngxs/devtools-plugin';
import { NgxsLoggerPluginModule } from '@ngxs/logger-plugin';
import { NgxsStoragePluginModule, StorageEngine } from '@ngxs/storage-plugin';
import { NgxsModule } from '@ngxs/store';
import { NgxsResetPluginModule } from 'ngxs-reset-plugin';


import { environment } from '../environments/environment';

import * as AllStores from '../stores';
import { GameAction } from '../interfaces';
import { GameModule } from './game.module';

import { AppComponent } from './app.component';

import { AssetService } from './services/asset.service';
import { GameService } from './services/game.service';
import { AlertErrorHandler, LoggerService } from './services/logger.service';
import { MacrosService } from './services/macros.service';
import { ModalService } from './services/modal.service';
import { OptionsService } from './services/options.service';
import { SocketService } from './services/socket.service';
import { SoundService } from './services/sound.service';
import { HttpErrorInterceptor } from './_shared/interceptors/http-error.interceptor';


const allActualStores = Object.keys(AllStores).filter(x => x.endsWith('State')).map(x => AllStores[x]);

export class AccountStorageEngine implements StorageEngine {
  get length(): number {
    return localStorage.length;
  }

  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }

  key(val: number): string {
    return localStorage.key(val);
  }
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    HttpClientModule,
    BrowserModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
    BrowserAnimationsModule,

    GameModule,

    NgxsModule.forRoot(allActualStores, { developmentMode: !environment.production }),
    NgxsStoragePluginModule.forRoot({
      key: ['settings', 'macros', 'journal']
    }),
    NgxsReduxDevtoolsPluginModule.forRoot({ disabled: environment.production }),
    NgxsResetPluginModule.forRoot(),
    NgxsLoggerPluginModule.forRoot({
      disabled: environment.production,
      collapsed: true,
      filter: action => {
        if (!action.type) return !action.filterOutFromLogs;

        const ignoreActions = {
          [GameAction.GameSetPlayer]: true,
          [GameAction.GamePatchPlayer]: true,
          [GameAction.GamePatchPlayerState]: true,
          [GameAction.GameSetPosition]: true,
          [GameAction.SetCurrentItemTooltip]: true,
          [GameAction.SettingsUpdateWindowPosition]: true,
          [GameAction.SettingsSetDefaultWindowPosition]: true,
          [GameAction.SettingsShowWindow]: true,
          [GameAction.SettingsActiveWindow]: true,
          [GameAction.SetCurrentCommand]: true,
          [GameAction.PartyUpdate]: true,
          [GameAction.LogCurrentCommand]: true
        };

        return !ignoreActions[action.type];
      }
    })
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (logger: LoggerService) => () => {
        logger.init();
        return logger;
      },
      deps: [LoggerService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (opts: OptionsService) => () => {
        opts.init();
        return opts;
      },
      deps: [OptionsService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (sc: SocketService) => () => {
        sc.init();
        return sc;
      },
      deps: [SocketService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (assets: AssetService) => () => {
        assets.init();
        return assets;
      },
      deps: [AssetService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (game: GameService) => () => {
        game.init();
        return game;
      },
      deps: [GameService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (macros: MacrosService) => () => {
        macros.init();
        return macros;
      },
      deps: [MacrosService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (modal: ModalService) => () => {
        modal.init();
        return modal;
      },
      deps: [ModalService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (sound: SoundService) => () => {
        sound.init();
        return sound;
      },
      deps: [SoundService],
      multi: true
    },
    {
      provide: ErrorHandler,
      useClass: AlertErrorHandler,
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
