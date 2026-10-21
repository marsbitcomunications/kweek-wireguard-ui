import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const api = axios.create({ baseURL: '/api' });

export default function WireGuardPeers() {
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrConfigText, setQrConfigText] = useState('');
  const [qrPeerName, setQrPeerName] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    allocated_ips: '10.0.0.2/32',
    custom_public_key: '',
    device_type: 'mobile'
  });

  const fetchPeers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/peers');
      setPeers(res.data);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg('Could not load peers from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPeers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/peers', formData);
      setShowModal(false);
      setFormData({ name: '', allocated_ips: '10.0.0.2/32', custom_public_key: '', device_type: 'mobile' });
      fetchPeers();
    } catch (err) {
      alert("Failed to create peer");
    }
  };

  const showQrCode = async (peer) => {
    try {
      const res = await api.get(`/peers/${peer.id}/config`);
      setQrConfigText(res.data);
      setQrPeerName(peer.name);
      setShowQrModal(true);
    } catch (err) {
      alert('Failed to generate QR code');
    }
  };

  const downloadConf = async (peerId) => {
    try {
      const res = await api.get(`/peers/${peerId}/config`);
      const blob = new Blob([res.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `peer-${peerId}.conf`;
      a.click();
    } catch (err) {
      alert('Failed to download config');
    }
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden p-4 md:p-6 text-gray-900">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-gray-900">WireGuard Management</h1>
          <p className="text-sm text-gray-600 mt-1">kweek_Wireguard-UI</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <button onClick={fetchPeers} className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-semibold transition shadow-sm w-full md:w-auto">
            Refresh Data
          </button>
          <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm w-full md:w-auto">
            + Add Peer
          </button>
        </div>
      </div>

      {errorMsg && <div className="mb-4 p-4 bg-rose-100 border border-rose-300 text-rose-800 font-medium rounded-xl text-sm">{errorMsg}</div>}

      {loading && peers.length === 0 ? (
        <div className="text-gray-600 font-medium p-6 text-center">Loading peers...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-300">
                <th className="p-3 md:p-4 font-bold">Name / Key</th>
                <th className="p-3 md:p-4 font-bold">IPs</th>
                <th className="p-3 md:p-4 font-bold">Connection</th>
                <th className="p-3 md:p-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {peers.map((peer) => (
                <tr key={peer.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 md:p-4 max-w-[200px] truncate">
                    <div className="truncate text-gray-900 font-bold">{peer.name}</div>
                    <div className="text-xs text-gray-500 font-mono truncate">{peer.public_key.substring(0, 16)}...</div>
                  </td>
                  <td className="p-3 md:p-4 font-mono text-xs text-gray-800 font-medium">{peer.allocated_ips}</td>
                  <td className="p-3 md:p-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${peer.is_online ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                      {peer.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="p-3 md:p-4 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button onClick={() => showQrCode(peer)} className="bg-purple-100 hover:bg-purple-200 text-purple-800 px-2.5 py-1 rounded text-xs font-bold border border-purple-300">QR Code</button>
                      <button onClick={() => downloadConf(peer.id)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2.5 py-1 rounded text-xs font-bold border border-gray-300">Config</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Peer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Register New Peer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-800 mb-1 font-semibold">Device Name</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-200" placeholder="e.g., My Phone" />
              </div>
              <div>
                <label className="block text-sm text-gray-800 mb-1 font-semibold">Allocated IP (VPN Subnet)</label>
                <input type="text" required value={formData.allocated_ips} onChange={(e) => setFormData({...formData, allocated_ips: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-200" placeholder="10.0.0.2/32" />
              </div>
              <div>
                <label className="block text-sm text-gray-800 mb-1 font-semibold">Device Type</label>
                <select value={formData.device_type} onChange={(e) => setFormData({...formData, device_type: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-200">
                  <option value="mobile">Mobile / Laptop (Auto-generate Keys)</option>
                  <option value="router">Hardware Router (Requires Public Key)</option>
                </select>
              </div>
              {formData.device_type === 'router' && (
                <div>
                  <label className="block text-sm text-gray-800 mb-1 font-semibold">Router Public Key</label>
                  <input type="text" required value={formData.custom_public_key} onChange={(e) => setFormData({...formData, custom_public_key: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-200" placeholder="Paste router public key here" />
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Save Peer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Scan to Connect</h2>
            <p className="text-sm font-semibold text-gray-600 mb-6">{qrPeerName}</p>
            <div className="bg-white p-4 rounded-xl border border-gray-300 inline-block shadow-sm">
              <QRCodeSVG value={qrConfigText} size={256} bgColor={"#ffffff"} fgColor={"#000000"} level={"L"} />
            </div>
            <button onClick={() => setShowQrModal(false)} className="w-full mt-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-bold text-gray-800">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}