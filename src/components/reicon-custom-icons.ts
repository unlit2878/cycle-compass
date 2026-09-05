import createIcon from 'reicon-react/createIcon';

// 按Solar/reicon风格重绘的业务图标：24网格、Outline为1.5线宽圆角笔画、Filled为实心形。
// 与reicon图标共用createIcon工厂，因此支持相同的 size / weight / color / strokeWidth 属性。

const S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const strokeWrap = (inner: string) => `<g ${S}>${inner}</g>`;
const fillWrap = (inner: string) => `<g fill="currentColor" stroke="none">${inner}</g>`;

/** 腹胀：胃袋轮廓 + 胃内气泡 */
export const BloatingIcon = createIcon('Bloating', {
  O: strokeWrap(
    '<path d="M9.4 3.25V5.7C6.3 6.6 4.25 9.3 4.25 12.5c0 4.1 3.3 7.1 7.4 7.1h3.3a4.8 4.8 0 0 0 4.8-4.8c0-2-1.1-3.7-2.85-4.6l-.9-.45A8.9 8.9 0 0 1 11.4 5.7V3.25"/>' +
    '<circle cx="9.1" cy="13.4" r="1.05"/>' +
    '<circle cx="12.7" cy="16.3" r="0.75"/>',
  ),
  F: fillWrap(
    '<path fill-rule="evenodd" d="M9.4 3.25h2V5.7a8.9 8.9 0 0 0 4.6 4.05l.9.45a6.05 6.05 0 0 1-2.75 11.4h-3.3a8.35 8.35 0 0 1-8.35-8.35c0-3.75 2.45-6.95 5.9-8.1V3.25Zm-.3 9.1a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm3.6 2.9a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>',
  ),
});

/** 便秘：马桶（忠实复刻原版自绘构图，等比缩至24网格+Solar圆角） */
export const ConstipationIcon = createIcon('Constipation', {
  O: strokeWrap(
    '<path d="M6.6 4.35h10.8v8.33a3.9 3.9 0 0 1-3.9 3.9h-3a3.9 3.9 0 0 1-3.9-3.9Z"/>' +
    '<path d="M6 16.58h12"/>' +
    '<path d="M9 16.58 6.45 20.25h11.1L15 16.58"/>',
  ),
  F: fillWrap(
    '<path d="M6.6 4.35h10.8v8.33a3.9 3.9 0 0 1-3.9 3.9h-3a3.9 3.9 0 0 1-3.9-3.9Z"/>' +
    '<path d="M9 16.58 6.45 20.25h11.1L15 16.58Z"/>',
  ),
});

/** 腹泻：卷纸（忠实复刻原版自绘构图，等比缩至24网格：横置圆柱+右端线+右下纸头） */
export const DiarrheaIcon = createIcon('Diarrhea', {
  O: strokeWrap(
    '<path d="M6.08 4.95h10.57a3 3 0 0 1 3 3v1.43a3 3 0 0 1-3 3h-1.05v6.82H7.42V8.1a3.15 3.15 0 0 1 3.15-3.15"/>' +
    '<path d="M15.6 4.95v7.43"/>',
  ),
  F: fillWrap(
    '<path d="M6.08 4.95h10.57a3 3 0 0 1 3 3v1.43a3 3 0 0 1-3 3h-1.05v6.82H7.42V8.1a3.15 3.15 0 0 1 3.15-3.15Z"/>' +
    '<path d="M16.35 6.1v5.55a3.75 3.75 0 0 1-1.5.72V6.1Z" fill="none" stroke="currentColor" stroke-width="1.1"/>',
  ),
});

/** 长痘：按 Material dermatology 构图重绘（皮肤横带+隆起+弯曲须+斑点）。
 *  仅定义 F（Filled）数据——createIcon 在缺失当前 weight 数据时回退到第一项，
 *  因此无论调用方传什么 weight 都渲染实心版（产品决定长痘固定用 Filled）。 */
export const AcneIcon = createIcon('Acne', {
  F: fillWrap(
    '<path fill-rule="evenodd" d="M2 21v-9q0-.83.59-1.41Q3.17 10 4 10h5v2q0 1.25.88 2.13Q10.75 15 12 15t2.13-.88Q15 13.25 15 12v-2h5q.83 0 1.41.59Q22 11.17 22 12v9H2ZM3.5 19.5V11.5h7v.5a1.5 1.5 0 0 0 3 0v-.5h7v8h-17Z"/>' +
    '<path d="M12 13q-.42 0-.71-.29T11 12q0-2.73.63-5.38t2.72-4.37q.33-.28.73-.24t.68.36q.28.33.24.73t-.61.78q-1.75 1.47-2.19 3.7t-.19 4.8q0 .43-.29.71T12 13Z"/>' +
    '<circle cx="5.75" cy="14.75" r=".75"/>' +
    '<circle cx="6.75" cy="17.25" r=".75"/>' +
    '<circle cx="18.25" cy="14.75" r=".75"/>',
  ),
});

/** 恶心：难受脸（眯眼+波浪嘴）+ 额角汗滴 */
export const NauseaIcon = createIcon('Nausea', {
  O: strokeWrap(
    '<circle cx="11.3" cy="12.9" r="7.7"/>' +
    '<path d="M8.1 10.4l1.7.85M14.5 10.4l-1.7.85"/>' +
    '<path d="M8.9 16c.62-.9 1.34-.9 1.95 0 .61.9 1.33.9 1.95 0"/>' +
    '<path d="M18.9 3.3c.9 1.15 1.45 2.05 1.45 2.8a1.45 1.45 0 1 1-2.9 0c0-.75.55-1.65 1.45-2.8Z" fill="currentColor" stroke="none"/>',
  ),
  F: fillWrap(
    '<path fill-rule="evenodd" d="M11 5.5a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8Zm-2.4 4.75 1.7.85-.65 1.3-1.7-.85.65-1.3Zm4.8 0 .65 1.3-1.7.85-.65-1.3 1.7-.85Zm-5 4.75c.6-.9 1.32-.9 1.93 0 .61.9 1.33.9 1.94 0l1.2.9c-1.1 1.5-3.17 1.5-4.27 0l1.2-.9Z"/>' +
    '<path d="M19.3 3.2c.9 1.15 1.45 2.05 1.45 2.8a1.45 1.45 0 1 1-2.9 0c0-.75.55-1.65 1.45-2.8Z"/>',
  ),
});

/** 疼痛·中等：两道闪电 */
export const PainModerateIcon = createIcon('PainModerate', {
  O: strokeWrap(
    '<path d="M13.1 3.4 7.6 11.8h3.85L9.9 19.7l5.75-8.45h-3.85L13.1 3.4Z"/>' +
    '<path d="M19.35 5.1l-3.6 5.5h2.5l-1.2 5.05 3.6-5.55h-2.5l1.2-5Z"/>',
  ),
  F: fillWrap(
    '<path d="M13.1 3.4 7.6 11.8h3.85L9.9 19.7l5.75-8.45h-3.85L13.1 3.4Z"/>' +
    '<path d="M19.35 5.1l-3.6 5.5h2.5l-1.2 5.05 3.6-5.55h-2.5l1.2-5Z"/>',
  ),
});

/** 疼痛·严重：三道闪电 */
export const PainSevereIcon = createIcon('PainSevere', {
  O: strokeWrap(
    '<path d="M10.6 3.4 5.1 11.8h3.85L7.4 19.7l5.75-8.45H9.3L10.6 3.4Z"/>' +
    '<path d="M17.6 3.9l-4 6.1h2.75l-1.3 5.6 4-6.15h-2.75l1.3-5.55Z"/>' +
    '<path d="M19.1 14.3l-2.9 4.45h2l-.95 4.05 2.9-4.5h-2l.95-4Z"/>',
  ),
  F: fillWrap(
    '<path d="M10.6 3.4 5.1 11.8h3.85L7.4 19.7l5.75-8.45H9.3L10.6 3.4Z"/>' +
    '<path d="M17.6 3.9l-4 6.1h2.75l-1.3 5.6 4-6.15h-2.75l1.3-5.55Z"/>' +
    '<path d="M19.1 14.3l-2.9 4.45h2l-.95 4.05 2.9-4.5h-2l.95-4Z"/>',
  ),
});

/** 流量·中等：水滴下半实心（半满） */
export const FlowMediumIcon = createIcon('FlowMedium', {
  O: strokeWrap(
    '<path d="M12 3.6c-3.55 4.15-5.35 7.1-5.35 9.65a5.35 5.35 0 0 0 10.7 0C17.35 10.7 15.55 7.75 12 3.6Z"/>' +
    '<path d="M6.65 13.25a5.35 5.35 0 0 0 10.7 0Z" fill="currentColor" stroke="none"/>',
  ),
  F: '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M12 3.6C8.45 7.75 6.65 10.7 6.65 13.25m10.7 0C17.35 10.7 15.55 7.75 12 3.6"/>' +
    '<path fill="currentColor" stroke="none" d="M6.65 13.25a5.35 5.35 0 0 0 10.7 0Z"/>',
});

/** 流量·非常多：实心水滴 + 双波浪 */
export const FlowVeryHeavyIcon = createIcon('FlowVeryHeavy', {
  O: strokeWrap(
    '<path d="M12 2.9c-3.1 3.6-4.65 6.2-4.65 8.5a4.65 4.65 0 0 0 9.3 0c0-2.3-1.55-4.9-4.65-8.5Z"/>' +
    '<path d="M4.55 18.35c1.8-1.2 3.5-1.2 5.3 0s3.5 1.2 5.3 0 3.5-1.2 5.3 0"/>' +
    '<path d="M6.1 21.1c1.8-1.2 3.5-1.2 5.3 0s3.5 1.2 5.3 0 3.5-1.2 5.3 0"/>',
  ),
  F: '<path fill="currentColor" stroke="none" d="M12 2.9c-3.1 3.6-4.65 6.2-4.65 8.5a4.65 4.65 0 0 0 9.3 0c0-2.3-1.55-4.9-4.65-8.5Z"/>' +
    '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.55 18.35c1.8-1.2 3.5-1.2 5.3 0s3.5 1.2 5.3 0 3.5-1.2 5.3 0"/><path d="M6.1 21.1c1.8-1.2 3.5-1.2 5.3 0s3.5 1.2 5.3 0 3.5-1.2 5.3 0"/></g>',
});

/** 未记录：虚线空圆，与心情圆脸族同几何（cx12 cy12），无表情。
 *  仅定义 O 数据——createIcon 在缺失当前 weight 数据时回退到第一项，
 *  因此无论调用方传什么 weight 都渲染同一虚线圆（"未记录"没有实心语义）。 */
export const NotRecordedIcon = createIcon('NotRecorded', {
  O: strokeWrap('<circle cx="12" cy="12" r="9.25" stroke-dasharray="3.4 2.7"/>'),
});
