/**
 * Валидирует входящее сообщение.
 *
 * @returns true если валидно. false если структура неверная — соединение
 *   следует закрыть (или хотя бы залогировать и игнорировать).
 *
 * Side-effect: removeAdditional удалит лишние поля прямо в объекте.
 */
export declare function validateMessage(msg: unknown): msg is {
    type: string;
    seq: number;
    ts: number;
    payload: unknown;
};
//# sourceMappingURL=schema.d.ts.map