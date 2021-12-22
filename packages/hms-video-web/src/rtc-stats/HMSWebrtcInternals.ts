import { RTCStatsMonitor } from './RTCStatsMonitor';
import { EventBus } from '../events/EventBus';
import { PeerConnectionType } from '.';
import { HMSWebrtcStats } from './HMSWebrtcStats';

export class HMSWebrtcInternals {
  private statsMonitor?: RTCStatsMonitor;
  private currentHmsStats?: HMSWebrtcStats;

  constructor(
    private readonly eventBus: EventBus,
    /**
     * Local track's stats are changed based on the native track ID which changes on mute/unmute/plugins.
     * This method is to get the track ID being sent(the active one in webrtc stats) given the original track ID.
     */
    private readonly getTrackIDBeingSent: (trackID: string) => string | undefined,
    private publishConnection?: RTCPeerConnection,
    private subscribeConnection?: RTCPeerConnection,
  ) {}

  getPublishPeerConnection() {
    return this.publishConnection;
  }

  getSubscribePeerConnection() {
    return this.subscribeConnection;
  }

  getHMSStats() {
    return this.currentHmsStats;
  }

  onStatsChange(statsChangeCb: (stats: HMSWebrtcStats) => void) {
    this.eventBus.statsUpdate.subscribe(statsChangeCb);
    return () => {
      this.eventBus.statsUpdate.unsubscribe(statsChangeCb);
    };
  }

  private handleStatsUpdate = (stats: Record<PeerConnectionType, RTCStatsReport>) => {
    /**
     * @TODO send prevStats when creating new HMSWebrtcStats to calculate bitrate based on delta
     */
    this.currentHmsStats = new HMSWebrtcStats(stats, this.getTrackIDBeingSent);
    this.eventBus.statsUpdate.publish(this.currentHmsStats);
  };

  /**
   * @internal
   */
  getStatsMonitor() {
    return this.statsMonitor;
  }

  /**
   *
   * @internal
   */
  setPeerConnections({ publish, subscribe }: { publish?: RTCPeerConnection; subscribe?: RTCPeerConnection }) {
    this.publishConnection = publish;
    this.subscribeConnection = subscribe;

    this.statsMonitor = new RTCStatsMonitor(
      this.eventBus.rtcStatsUpdate,
      Object.assign(
        {},
        this.publishConnection && { publish: this.publishConnection },
        this.subscribeConnection && { subscribe: this.subscribeConnection },
      ),
    );
    this.eventBus.rtcStatsUpdate.subscribe(this.handleStatsUpdate);
  }

  /**
   * @internal
   */
  cleanUp() {
    this.statsMonitor?.stop();
    this.eventBus.rtcStatsUpdate.removeAllListeners();
    this.eventBus.statsUpdate.removeAllListeners();
  }
}
