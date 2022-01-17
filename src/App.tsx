/*
*  Copyright (C) 1998-2021 by Northwoods Software Corporation. All Rights Reserved.
*/

import * as go from 'gojs';
import { produce } from 'immer';
import * as React from 'react';

import DiagramWrapper  from './components/DiagramWrapperCopy2';
import { SelectionInspector } from './components/SelectionInspector';

import './App.css';

/**
 * Use a linkDataArray since we'll be using a GraphLinksModel,
 * and modelData for demonstration purposes. Note, though, that
 * both are optional props in ReactDiagram.
 */
interface AppState {
  nodeDataArray: Array<go.ObjectData>;
  modelData: go.ObjectData;
  selectedData: go.ObjectData | null;
  skipsDiagramUpdate: boolean;
}

class App extends React.Component<{}, AppState> {
  // Maps to store key -> arr index for quick lookups
  private mapNodeKeyIdx: Map<go.Key, number>;

  constructor(props: object) {
    super(props);
    this.state = {
      "nodeDataArray": [
        {"key":1, "name":"Stella Payne Diaz", "title":"CEO"},
        {"key":2, "name":"Luke Warm", "title":"VP Marketing/Sales", "parent":1},
        {"key":3, "name":"Meg Meehan Hoffa", "title":"Sales", "parent":2},
        {"key":4, "name":"Peggy Flaming", "title":"VP Engineering", "parent":1},
        {"key":5, "name":"Saul Wellingood", "title":"Manufacturing", "parent":4},
        {"key":6, "name":"Al Ligori", "title":"Marketing", "parent":2},
        {"key":7, "name":"Dot Stubadd", "title":"Sales Rep", "parent":3},
        {"key":8, "name":"Les Ismore", "title":"Project Mgr", "parent":5},
        {"key":9, "name":"April Lynn Parris", "title":"Events Mgr", "parent":6},
        {"key":10, "name":"Xavier Breath", "title":"Engineering", "parent":4},
        {"key":11, "name":"Anita Hammer", "title":"Process", "parent":5},
        {"key":12, "name":"Billy Aiken", "title":"Software", "parent":10},
        {"key":13, "name":"Stan Wellback", "title":"Testing", "parent":10},
        {"key":14, "name":"Marge Innovera", "title":"Hardware", "parent":10},
        {"key":15, "name":"Evan Elpus", "title":"Quality", "parent":5},
        {"key":16, "name":"Lotta B. Essen", "title":"Sales Rep", "parent":3},
        {"key":17, "name":"Joaquin Closet", "title":"Wardrobe Assistant", "parent":1},
        {"key":18, "name":"Hannah Twomey", "title":"Engineering Assistant", "parent":10, "isAssistant":true}
      ],
      modelData: {
        canRelink: false
      },
      selectedData: null,
      skipsDiagramUpdate: false
    };
    // init maps
    this.mapNodeKeyIdx = new Map<go.Key, number>();
    this.refreshNodeIndex(this.state.nodeDataArray);
    // bind handler methods
    this.handleDiagramEvent = this.handleDiagramEvent.bind(this);
    // this.handleModelChange = this.handleModelChange.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  /**
   * Update map of node keys to their index in the array.
   */
  private refreshNodeIndex(nodeArr: Array<go.ObjectData>) {
    this.mapNodeKeyIdx.clear();
    nodeArr.forEach((n: go.ObjectData, idx: number) => {
      this.mapNodeKeyIdx.set(n.key, idx);
    });
  }

  /**
   * Handle any relevant DiagramEvents, in this case just selection changes.
   * On ChangedSelection, find the corresponding data and set the selectedData state.
   * @param e a GoJS DiagramEvent
   */
  public handleDiagramEvent(e: go.DiagramEvent) {
    const name = e.name;
    switch (name) {
      case 'ChangedSelection': {
        const sel = e.subject.first();
        this.setState(
          produce((draft: AppState) => {
            if (sel) {
              if (sel instanceof go.Node) {
                const idx = this.mapNodeKeyIdx.get(sel.key);
                if (idx !== undefined && idx >= 0) {
                  const nd = draft.nodeDataArray[idx];
                  draft.selectedData = nd;
                }
              } 
            } else {
              draft.selectedData = null;
            }
          })
        );
        break;
      }
      default: break;
    }
  }

  /**
   * Handle GoJS model changes, which output an object of data changes via Model.toIncrementalData.
   * This method iterates over those changes and updates state to keep in sync with the GoJS model.
   * @param obj a JSON-formatted string
   */
  // public handleModelChange(obj: go.IncrementalData) {
  //   const insertedNodeKeys = obj.insertedNodeKeys;
  //   const modifiedNodeData = obj.modifiedNodeData;
  //   const removedNodeKeys = obj.removedNodeKeys;
  //   const modifiedModelData = obj.modelData;

  //   // maintain maps of modified data so insertions don't need slow lookups
  //   const modifiedNodeMap = new Map<go.Key, go.ObjectData>();
  //   this.setState(
  //     produce((draft: AppState) => {
  //       let narr = draft.nodeDataArray;
  //       if (modifiedNodeData) {
  //         modifiedNodeData.forEach((nd: go.ObjectData) => {
  //           modifiedNodeMap.set(nd.key, nd);
  //           const idx = this.mapNodeKeyIdx.get(nd.key);
  //           if (idx !== undefined && idx >= 0) {
  //             narr[idx] = nd;
  //             if (draft.selectedData && draft.selectedData.key === nd.key) {
  //               draft.selectedData = nd;
  //             }
  //           }
  //         });
  //       }
  //       if (insertedNodeKeys) {
  //         insertedNodeKeys.forEach((key: go.Key) => {
  //           const nd = modifiedNodeMap.get(key);
  //           const idx = this.mapNodeKeyIdx.get(key);
  //           if (nd && idx === undefined) {  // nodes won't be added if they already exist
  //             this.mapNodeKeyIdx.set(nd.key, narr.length);
  //             narr.push(nd);
  //           }
  //         });
  //       }
  //       if (removedNodeKeys) {
  //         narr = narr.filter((nd: go.ObjectData) => {
  //           if (removedNodeKeys.includes(nd.key)) {
  //             return false;
  //           }
  //           return true;
  //         });
  //         draft.nodeDataArray = narr;
  //         this.refreshNodeIndex(narr);
  //       }
  //       // handle model data changes, for now just replacing with the supplied object
  //       if (modifiedModelData) {
  //         draft.modelData = modifiedModelData;
  //       }
  //       draft.skipsDiagramUpdate = true;  // the GoJS model already knows about these updates
  //     })
  //   );
  // }

  /**
   * Handle inspector changes, and on input field blurs, update node data state.
   * @param path the path to the property being modified
   * @param value the new value of that property
   * @param isBlur whether the input event was a blur, indicating the edit is complete
   */
  public handleInputChange(path: string, value: string, isBlur: boolean) {
    this.setState(
      produce((draft: AppState) => {
        const data = draft.selectedData as go.ObjectData;  // only reached if selectedData isn't null
        data[path] = value;
        if (isBlur) {
          const key = data.key;
            const idx = this.mapNodeKeyIdx.get(key);
            if (idx !== undefined && idx >= 0) {
              draft.nodeDataArray[idx] = data;
              draft.skipsDiagramUpdate = false;
            }
        }
      })
    );
  }


  public render() {
    const selectedData = this.state.selectedData;
    let inspector;
    if (selectedData !== null) {
      inspector = <SelectionInspector
                    selectedData={this.state.selectedData}
                    onInputChange={this.handleInputChange}
                  />;
    }

    return (
      <div>
        <DiagramWrapper
          nodeDataArray={this.state.nodeDataArray}
          modelData={this.state.modelData}
          skipsDiagramUpdate={this.state.skipsDiagramUpdate}
          onDiagramEvent={this.handleDiagramEvent}
          // onModelChange={this.handleModelChange}
        />
        {inspector}
      </div>
    );
  }
}

export default App;
