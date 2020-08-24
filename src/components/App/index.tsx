import { h, Component } from 'preact';

import { bind, linkRef, Fileish } from '../../lib/initial-util';
import * as style from './style.scss';
import { FileDropEvent } from 'file-drop-element';
import 'file-drop-element';
import SnackBarElement, { SnackOptions } from '../../lib/SnackBar';
import '../../lib/SnackBar';
import Intro from '../intro';
import '../custom-els/LoadingSpinner';

const ROUTE_EDITOR = '/editor';

const compressPromise = import(
  /* webpackChunkName: "main-app" */
  '../compress');

const swBridgePromise = import(
  /* webpackChunkName: "sw-bridge" */
  '../../lib/sw-bridge');

function back() {
  window.history.back();
}

interface Props {}

interface State {
  awaitingShareTarget: boolean;
  file?: File | Fileish;
  drops: File[];
  isEditorOpen: Boolean;
  Compress?: typeof import('../compress').default;
  fetchingIndex:number
}

export default class App extends Component<Props, State> {
  state: State = {
    awaitingShareTarget: new URL(location.href).searchParams.has('share-target'),
    isEditorOpen: false,
    file: undefined,
    drops:[],
    Compress: undefined,
    fetchingIndex:0
  };

  snackbar?: SnackBarElement;
  drops?:File[];
  constructor() {
    super();

    compressPromise.then((module) => {
      this.setState({ Compress: module.default });
    }).catch(() => {
      this.showSnack('Failed to load app');
    });

    swBridgePromise.then(async ({ offliner, getSharedImage }) => {
      offliner(this.showSnack);
      if (!this.state.awaitingShareTarget) return;
      const file = await getSharedImage();
      // Remove the ?share-target from the URL
      history.replaceState('', '', '/');
      this.openEditor();
      this.setState({ file, awaitingShareTarget: false });
    });

    // In development, persist application state across hot reloads:
    if (process.env.NODE_ENV === 'development') {
      this.setState(window.STATE);
      const oldCDU = this.componentDidUpdate;
      this.componentDidUpdate = (props, state, prev) => {
        if (oldCDU) oldCDU.call(this, props, state, prev);
        window.STATE = this.state;
      };
    }

    // Since iOS 10, Apple tries to prevent disabling pinch-zoom. This is great in theory, but
    // really breaks things on Squoosh, as you can easily end up zooming the UI when you mean to
    // zoom the image. Once you've done this, it's really difficult to undo. Anyway, this seems to
    // prevent it.
    document.body.addEventListener('gesturestart', (event) => {
      event.preventDefault();
    });

    window.addEventListener('popstate', this.onPopState);
  }

  @bind
  private onFileDrop({ files }: FileDropEvent) {
    if (!files || files.length === 0) return;
    const file = files[0];
    this.openEditor();
    this.setState({ file,drops:files,fetchingIndex:0});
  }

  @bind
  private onIntroPickFile(file: File | Fileish) {
    this.openEditor();
    this.setState({ file });
  }

  @bind
  private showSnack(message: string, options: SnackOptions = {}): Promise<string> {
    if (!this.snackbar) throw Error('Snackbar missing');
    return this.snackbar.showSnackbar(message, options);
  }

  @bind
  private onPopState() {
    this.setState({ isEditorOpen: location.pathname === ROUTE_EDITOR });
  }

  @bind
  private openEditor() {
    if (this.state.isEditorOpen) return;
    // Change path, but preserve query string.
    const editorURL = new URL(location.href);
    editorURL.pathname = ROUTE_EDITOR;
    history.pushState(null, '', editorURL.href);
    this.setState({ isEditorOpen: true });
  }

  @bind
  onNext(){
    const {fetchingIndex,drops} = this.state;
    if(fetchingIndex==drops.length-1) {
      this.showSnack('finish',{timeout:3000,actions:['OK']});
      return;
    }
    console.log(fetchingIndex+1);
    const file = drops[fetchingIndex+1];
    this.setState({file,fetchingIndex:fetchingIndex+1})
  }

  render({}: Props, { file, isEditorOpen, Compress, awaitingShareTarget,drops,fetchingIndex}: State) {
    const showSpinner = awaitingShareTarget || (isEditorOpen && !Compress);
    return (
      <div id="app" class={style.app}>
        <file-drop accept="image/*" onfiledrop={this.onFileDrop} class={style.drop} multiple>
          {
            showSpinner
              ? <loading-spinner class={style.appLoader}/>
              : isEditorOpen
                ? Compress && <Compress files={drops} file={file!} showSnack={this.showSnack} onBack={back} onNext={this.onNext}/>
                :<Intro onFile={this.onIntroPickFile} showSnack={this.showSnack}/>
          }
          <snack-bar ref={linkRef(this, 'snackbar')} />
        </file-drop>
        <div class={style.files}>
          <ul class={style.demos}>
            {drops.map((f, i) =>
               <li key={i} class={style.demoItem}>
                 <div class={style.demo}>
                   <div class={style.demoImgContainer}>
                     <div class={style.demoImgAspect}>
                       <img class={style.demoIcon} src={URL.createObjectURL(f)} alt="" decoding="async"/>
                       {fetchingIndex === i &&
                       <div class={style.demoLoading}>
                         {/*<loading-spinner className={style.demoLoadingSpinner}/>*/}
                       </div>
                       }
                     </div>
                   </div>
                   <div class={style.demoDesc}>
                     <div class={style.demoDescription}>{f.name}</div>
                     <div class={style.demoDescription}>{'('+f.size/1000+'k)'}</div>
                   </div>
                 </div>
               </li>
            )}
          </ul>
        </div>
      </div>
    );
  }
}
