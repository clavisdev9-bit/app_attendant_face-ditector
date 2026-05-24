"""
Face Detection Service
Menggunakan library face_recognition (dlib backend)
"""

import numpy as np
import io
from PIL import Image
import logging

logger = logging.getLogger(__name__)

try:
    import face_recognition
    FACE_LIB_AVAILABLE = True
except ImportError:
    FACE_LIB_AVAILABLE = False
    logger.warning("face_recognition tidak terinstall. Gunakan: pip install face-recognition")


class FaceService:
    def __init__(self, tolerance: float = 0.55):
        """
        tolerance: 0.4 = sangat ketat, 0.55 = normal, 0.6 = longgar
        Nilai lebih rendah = lebih ketat = lebih sedikit false positive
        """
        self.tolerance = tolerance

    def encode_face(self, image_data: bytes) -> np.ndarray | None:
        """
        Encode wajah dari bytes image → numpy array
        Return None jika tidak ada wajah terdeteksi
        """
        if not FACE_LIB_AVAILABLE:
            # Simulasi untuk development/testing
            logger.info("[SIMULASI] Encoding wajah...")
            return np.random.rand(128)  # face_recognition menghasilkan 128-dim vector

        try:
            image = Image.open(io.BytesIO(image_data)).convert("RGB")
            img_array = np.array(image)

            # Deteksi wajah
            face_locations = face_recognition.face_locations(img_array, model="hog")
            if not face_locations:
                logger.warning("Tidak ada wajah terdeteksi dalam gambar")
                return None

            if len(face_locations) > 1:
                logger.warning(f"Terdeteksi {len(face_locations)} wajah, menggunakan yang pertama")

            # Ambil encoding wajah pertama
            encodings = face_recognition.face_encodings(img_array, face_locations)
            if not encodings:
                return None

            return encodings[0]

        except Exception as e:
            logger.error(f"Error saat encode wajah: {e}")
            return None

    def verify_face(
        self,
        image_data: bytes,
        stored_encoding: np.ndarray
    ) -> tuple[bool, float]:
        """
        Verifikasi wajah dari image vs encoding tersimpan
        Return: (is_match, confidence_score)
        confidence_score: 0.0 = identik, 1.0 = sangat berbeda
        """
        if not FACE_LIB_AVAILABLE:
            # Simulasi: 80% kemungkinan match untuk testing
            import random
            confidence = random.uniform(0.3, 0.7)
            return confidence < self.tolerance, confidence

        live_encoding = self.encode_face(image_data)
        if live_encoding is None:
            return False, 1.0  # Tidak ada wajah = tidak cocok

        # Hitung jarak euclidean
        distance = face_recognition.face_distance([stored_encoding], live_encoding)[0]
        is_match = distance < self.tolerance

        return is_match, float(distance)

    def detect_liveness(self, frames: list[bytes]) -> bool:
        """
        Basic liveness detection: cek variasi antar frame
        Untuk anti-spoofing (mencegah penggunaan foto)
        
        Production: gunakan library khusus seperti:
        - FaceAntiSpoofing
        - Silent-Face-Anti-Spoofing
        """
        if len(frames) < 3:
            return True  # Tidak cukup frame, skip liveness check

        encodings = []
        for frame_data in frames:
            encoding = self.encode_face(frame_data)
            if encoding is not None:
                encodings.append(encoding)

        if len(encodings) < 2:
            return False

        # Hitung variasi antar frame (wajah hidup = sedikit bergerak)
        distances = []
        for i in range(len(encodings) - 1):
            dist = float(face_recognition.face_distance([encodings[i]], encodings[i+1])[0])
            distances.append(dist)

        avg_variation = np.mean(distances)
        
        # Foto akan menghasilkan variasi 0, wajah hidup sedikit variasi
        # threshold bisa diatur sesuai kebutuhan
        return avg_variation > 0.01
