# 投球動作實驗室

上傳標準投球影片與練習影片，自動找出抬腿、前腳落地、出手三個錨點並對齊動作，比較關節角度差異，並由影片估算球速。

**使用網址：** https://2tcgft5yhc-prog.github.io/pitch-lab/

- 所有分析都在瀏覽器內完成，影片不會上傳。
- 建議用手機慢動作（240fps）、腳架固定、從側面拍攝。
- 本工具是動作分析，不是醫療診斷；若投球時疼痛，請找物理治療師或防護員評估。

## 使用的模型
- 姿勢辨識：Google MediaPipe Pose Landmarker
- 錨點偵測模型、角度模型：以 [Driveline OpenBiomechanics Project](https://github.com/drivelineresearch/openbiomechanics) 的動作捕捉資料模擬手機側拍訓練，內嵌於 `index.html`

## 授權
- 網站程式碼：版權所有，保留一切權利。
- 內嵌的 AI 模型衍生自 OpenBiomechanics 資料，依 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 授權，僅限非商業用途，衍生作品須以相同授權分享。
