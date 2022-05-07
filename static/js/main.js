console.log('In main.js!')

let mapPeers = {};

let usernameInput = document.querySelector('#username');
let btnJoin = document.querySelector('#btn-join');

let username;

let webSocket;

function webSocketOnMessage(event){
    let parsedData = JSON.parse(event.data);
    let peerUsername = parsedData['peer'];
    let action = parsedData['action'];

    if(username == peerUsername){
        return;
    }

    let receiver_channel_name = parsedData['message']['receiver_channel_name'];

    if(action == 'new-peer'){
        createOfferer(peerUsername, receiver_channel_name);

        return;
    }

    if(action == 'new-offer'){
        let offer = parsedData['message']['sdp'];

        createAnswerer(offer, peerUsername, receiver_channel_name);

        return;
    }

    if(action == 'new-answer'){
        let answer = parsedData['message']['sdp'];
        
        let peer = mapPeers[peerUsername][0];

        peer.setRemoteDescription(answer);
        
        return;
    }
}

btnJoin.addEventListener('click', () => {
    username = usernameInput.value;

    console.log('username: ', username);

    if(username == ''){
        return;
    }

    usernameInput.value = '';
    usernameInput.disabled = true;
    usernameInput.style.visibility = 'hidden';

    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';

    let labelUsername = document.querySelector('#label-username');
    labelUsername.innerHTML = username;

    let loc = window.location;
    let wsStart = 'ws://';

    if(loc.protocol == 'https:'){
        wsStart = 'wss://';
    }

    let endPoint = wsStart + loc.host + loc.pathname;
    // console.log('endPoint: ', endPoint);

    webSocket = new WebSocket(endPoint);

    webSocket.addEventListener('open', (e) => {
        console.log('Connection Opened!');

        sendSignal('new-peer', {})
    });
    webSocket.addEventListener('message', webSocketOnMessage);
    webSocket.addEventListener('close', (e) => {
        console.log('Connection Closed!');
    });
    webSocket.addEventListener('error', (e) => {
        console.log('Error Occurred!');
    });

});

let localStream = new MediaStream();

const constraints = {
    'video': true,
    'audio': true
};

const localVideo = document.querySelector('#local-video');

const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');

const audioIcon = document.querySelector('#audio-icon');
const videoIcon = document.querySelector('#video-icon');


let userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        let audioTracks = stream.getAudioTracks();
        let videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if(audioTracks[0].enabled){
                audioIcon.src = "/static/img/speaker.png"
                return;
            }
            audioIcon.src = "/static/img/silent.png"
        });

        btnToggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if(videoTracks[0].enabled){
                videoIcon.src = "/static/img/visible.png"
                return;
            }
            videoIcon.src = "/static/img/hidden.png"
        });
    })
    .catch(error => {
        console.log('Error accessing media devices.', error);
    });

let btnSendMsg = document.querySelector('#btn-send-msg');
let messageList = document.querySelector('#message-list');
let messageInput = document.querySelector('#msg');

btnSendMsg.addEventListener('click', sendMsgOnClick);

function sendMsgOnClick(){
    let message = messageInput.value;
    
    let li = document.createElement('li');
    li.appendChild(document.createTextNode('Me: ' + message));
    messageList.appendChild(li);

    let dataChannels = getDataChannels();

    message = username + ': ' + message;

    for(index in dataChannels){
        dataChannels[index].send(message);
    }

    messageInput.value = '';
}
    
function sendSignal(action, message){
    let jsonStr = JSON.stringify({
        'peer': username, 
        'action': action,
        'message': message,
    });

    webSocket.send(jsonStr);
}

function createOfferer(peerUsername, receiver_channel_name){
    let peer = new RTCPeerConnection(null);

    addLocalTracks(peer);

    let dc = peer.createDataChannel('channel');
    dc.addEventListener('open', () => {
        console.log('Connection opened!');
    });
    dc.addEventListener('message', dcOnMessage);

    let remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc];

    peer.addEventListener('iceconnectionstatechange', () => {
        let iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername];

            if(iceConnectionState != 'closed'){
                peer.close();
            }

            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('New ice candidate!');
            // console.log('New ice candidate: ', JSON.stringify(peer.localDescription));
            
            return;
        }
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log('Local description set successfully');
        });

}

function createAnswerer(offer, peerUsername, receiver_channel_name){
    let peer = new RTCPeerConnection(null);

    addLocalTracks(peer);

    let remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open', () => {
            console.log('Connection opened!');
        });
        peer.dc.addEventListener('message', dcOnMessage);

        mapPeers[peerUsername] = [peer, peer.dc];
    })

    peer.addEventListener('iceconnectionstatechange', () => {
        let iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername];

            if(iceConnectionState != 'closed'){
                peer.close();
            }

            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('New ice candidate!');
            // console.log('New ice candidate: ', JSON.stringify(peer.localDescription));
            
            return;
        }
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Remote description set successfully for %s.', peerUsername);

            return peer.createAnswer();
        })
        .then(a => {
            console.log('Answer created!');
            
            peer.setLocalDescription(a);
        })
}

function addLocalTracks(peer){
    localStream.getTracks().forEach(track =>{
        peer.addTrack(track, localStream);
    });

    return;
}

function dcOnMessage(event){
    let message = event.data;
    console.log(message);

    let li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);
}

function createVideo(peerUsername){
    let videoContainer = document.querySelector('#video-container');

    let remoteVideo = document.createElement('video');
    remoteVideo.id = peerUsername + '-video';
    remoteVideo.className = 'my-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;

    let videoWrapper = document.createElement('div');
    let nameWrapper = document.createElement('div');
    let contentWrapper = document.createElement('div');

    contentWrapper.className = 'video-wrapper';
    videoWrapper.className = 'wrapper';
    
    nameWrapper.innerHTML = peerUsername;
    nameWrapper.className = 'username';

    videoContainer.appendChild(contentWrapper);
    
    contentWrapper.appendChild(nameWrapper);
    contentWrapper.appendChild(videoWrapper);

    videoWrapper.appendChild(remoteVideo);

    return remoteVideo;
}

function setOnTrack(peer, remoteVideo){
    let remoteStream = new MediaStream();

    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream);
    })
}

function removeVideo(video){
    let videoWrapper = video.parentNode.parentNode;

    videoWrapper.parentNode.removeChild(videoWrapper);
}

function getDataChannels(){
    let dataChannels = [];

    for(peerUsername in mapPeers){
        let dataChannel = mapPeers[peerUsername][1];

        dataChannels.push(dataChannel);
    }

    return dataChannels;
}
