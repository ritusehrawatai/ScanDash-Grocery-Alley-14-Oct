import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Unplug,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Reader } from '@stripe/terminal-js';
import { stripeTerminalManager } from '../../services/terminalService';
import { ReaderConnectionState } from '../../types/terminal';

export const PaymentDeviceSection: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ReaderConnectionState>('Disconnected');
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = stripeTerminalManager.subscribe({
      onStateChange: (state, reader, error) => {
        setConnectionState(state);
        setConnectedReader(reader);
        setErrorMessage(error);
      },
      onDiscoveredReadersChange: (readers) => {
        setDiscoveredReaders(readers);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDiscoverAndConnect = async () => {
    setIsDiscovering(true);
    setErrorMessage(null);
    try {
      const readers = await stripeTerminalManager.discoverSimulatedReaders();
      if (readers.length > 0) {
        // Automatically connect to the first simulated reader
        await stripeTerminalManager.connectReader(readers[0]);
      } else {
        setErrorMessage('No simulated readers found. Please retry discovery.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to discover or connect simulated reader');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConnectSpecific = async (reader: Reader) => {
    setErrorMessage(null);
    try {
      await stripeTerminalManager.connectReader(reader);
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection failed');
    }
  };

  const handleDisconnect = async () => {
    await stripeTerminalManager.disconnectReader();
  };

  // Helper badge for the connection state
  const renderStateBadge = () => {
    switch (connectionState) {
      case 'Connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span>Connected</span>
          </span>
        );
      case 'Connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
            <span>Connecting...</span>
          </span>
        );
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Error</span>
          </span>
        );
      case 'Disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <WifiOff className="w-3 h-3 text-stone-400" />
            <span>Disconnected</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2.5 transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-700 shadow-2xs">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-900 tracking-tight">Payment Device</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-stone-200/70 text-stone-600 rounded">
                Stripe Terminal
              </span>
            </div>
            <p className="text-[10px] text-stone-500">In-person card reader (Simulated Test Mode)</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {renderStateBadge()}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
            title={isExpanded ? 'Collapse reader details' : 'Expand reader details'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Connected Reader Display */}
      {connectionState === 'Connected' && connectedReader && (
        <div className="p-2.5 bg-white border border-emerald-200/80 rounded-lg flex items-center justify-between gap-2 shadow-2xs">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-900 truncate flex items-center gap-1">
                <span>{connectedReader.label || 'Simulated WisePOS E'}</span>
                <span className="text-[10px] font-normal text-emerald-700 font-mono">
                  ({connectedReader.device_type || 'card_present'})
                </span>
              </div>
              <p className="text-[10px] font-mono text-stone-500 truncate">
                SN: {connectedReader.serial_number || 'SIMULATED-TEST-001'} · Ready for tap/chip
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-600 hover:text-rose-700 hover:bg-rose-50 border border-stone-200 hover:border-rose-200 rounded-md transition-colors cursor-pointer"
            title="Disconnect current payment reader"
          >
            <Unplug className="w-3 h-3" />
            <span>Disconnect</span>
          </button>
        </div>
      )}

      {/* Disconnected / Error State Actions */}
      {connectionState !== 'Connected' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={isDiscovering || connectionState === 'Connecting'}
            onClick={handleDiscoverAndConnect}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-stone-900 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-300 shadow-2xs transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isDiscovering || connectionState === 'Connecting' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-stone-500" />
                <span>Connecting Simulated Reader...</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span>{connectionState === 'Error' ? 'Retry Simulated Reader' : 'Connect Simulated Reader'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-tight font-medium break-words">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[11px] text-rose-600 hover:text-rose-800 font-bold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expanded Technical Details & Reader List */}
      {isExpanded && (
        <div className="pt-2 border-t border-stone-200 text-[11px] space-y-2 text-stone-600">
          <div className="flex items-center justify-between text-stone-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Token Endpoint:</span>
            </div>
            <span className="font-mono text-[10px]">/api/v1/payments/terminal/connection-token</span>
          </div>

          {discoveredReaders.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-stone-700 block">Available Readers:</span>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {discoveredReaders.map((r) => (
                  <div
                    key={r.id || r.serial_number}
                    className="p-1.5 bg-white border border-stone-200 rounded flex items-center justify-between text-[10px]"
                  >
                    <div>
                      <span className="font-medium text-stone-900">{r.label || 'Simulated Reader'}</span>
                      <span className="text-stone-400 font-mono ml-1">({r.serial_number})</span>
                    </div>
                    {connectedReader?.id === r.id ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConnectSpecific(r)}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded cursor-pointer"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
