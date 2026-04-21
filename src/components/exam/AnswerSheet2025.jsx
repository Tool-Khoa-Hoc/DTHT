import React from 'react';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const TRUE_FALSE_LABELS = ['a', 'b', 'c', 'd'];
const SHORT_ANSWER_ROWS = ['-', ',', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SHORT_ANSWER_SLOT_COUNT = 4;

function chunk(items, size) {
    const source = Array.isArray(items) ? items : [];
    const result = [];

    for (let index = 0; index < source.length; index += size) {
        result.push(source.slice(index, index + size));
    }

    return result;
}

function getQuestionKey(partId, questionId) {
    return `${partId}.${questionId}`;
}

function getStatementId(statement, index) {
    return statement?.id || TRUE_FALSE_LABELS[index];
}

function normalizeShortAnswerValue(value) {
    return String(value ?? '')
        .replace(/\./g, ',')
        .replace(/\s+/g, '')
        .replace(/[^0-9,\-]/g, '')
        .slice(0, SHORT_ANSWER_SLOT_COUNT);
}

function SectionHeading({ label }) {
    return (
        <div className="mb-4 flex items-center gap-4">
            <span className="h-5 w-5 rounded-[6px] bg-gradient-to-b from-red-600 to-rose-500 shadow-[0_8px_18px_rgba(225,29,72,0.28)]" />
            <h2 className="text-[1.55rem] font-black uppercase tracking-[0.14em] text-red-600 md:text-[1.8rem]">
                {label}
            </h2>
        </div>
    );
}

function SectionPanel({ label, note, children }) {
    return (
        <section className="as25-section-shell">
            <SectionHeading label={label} />
            {note ? <p className="as25-section-note">{note}</p> : null}
            {children}
        </section>
    );
}

export default function AnswerSheet2025({ examData, answers, handleAnswerChange, readOnly = false }) {
    const parts = Array.isArray(examData?.parts) ? examData.parts : [];
    const part1 = parts.find((part) => part?.questions?.some((question) => question.type === 'single_choice'));
    const part2 = parts.find((part) => part?.questions?.some((question) => question.type === 'true_false'));
    const part3 = parts.find((part) => part?.questions?.some((question) => question.type === 'short_answer'));

    const part1Questions = Array.isArray(part1?.questions) ? part1.questions : [];
    const part2Questions = Array.isArray(part2?.questions) ? part2.questions : [];
    const part3Questions = Array.isArray(part3?.questions) ? part3.questions : [];

    const part1Id = part1?.id || 'part-1';
    const part2Id = part2?.id || 'part-2';
    const part3Id = part3?.id || 'part-3';

    const part1Groups = chunk(part1Questions, 10);

    const css = `
        .as25-section-shell {
            border: 1px solid rgba(244, 114, 182, 0.18);
            border-radius: 16px;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.70) 0%, rgba(255, 244, 246, 0.96) 100%);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
            padding: 12px;
        }

        .as25-section-note {
            margin: 0 0 10px;
            color: #8f4c5c;
            font-size: 0.75rem;
            font-weight: 600;
            line-height: 1.4;
        }

        .as25-card {
            border: 1.5px solid #f25569;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 8px 24px rgba(244, 63, 94, 0.08);
            min-width: 0;
        }

        .as25-card--mc {
            padding: 10px 12px;
        }

        .as25-card--tf,
        .as25-card--sa {
            padding: 12px 14px;
        }

        .as25-panel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
        }

        .as25-panel-grid--short {
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }

        .as25-bubble {
            width: 20px;
            height: 20px;
            border: 1.2px solid #f25569;
            border-radius: 999px;
            background: #ffffff;
            cursor: pointer;
            transition: transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
            box-sizing: border-box;
        }

        .as25-bubble:hover:not(:disabled) {
            transform: scale(1.1);
            background: #fff1f4;
            border-color: #e11d48;
        }

        .as25-bubble.is-filled {
            background: #ef334f;
            border-color: #ef334f;
            box-shadow: 0 0 0 2px #ffe1e7;
        }

        .as25-bubble:disabled {
            cursor: default;
            opacity: 0.55;
        }

        .as25-bubble--mini {
            width: 14px;
            height: 14px;
        }

        .as25-mc-grid {
            display: grid;
            grid-template-columns: 20px repeat(4, minmax(0, 1fr));
            align-items: center;
            justify-items: center;
            gap: 6px;
        }

        .as25-mc-label {
            text-align: center;
            color: #f25569;
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.1em;
        }

        .as25-qno {
            text-align: center;
            color: #334155;
            font-size: 0.85rem;
            font-weight: 800;
            line-height: 1;
        }

        .as25-qno.is-answered,
        .as25-tf-label.is-answered,
        .as25-sa-title.is-answered {
            color: #e11d48;
        }

        .as25-card-title {
            text-align: center;
            color: #1e293b;
            font-size: 1.1rem;
            font-weight: 900;
            line-height: 1.1;
        }

        .as25-card-divider {
            height: 1px;
            margin: 8px 0 10px;
            background: linear-gradient(90deg, rgba(242, 85, 105, 0) 0%, rgba(242, 85, 105, 0.28) 18%, rgba(242, 85, 105, 0.28) 82%, rgba(242, 85, 105, 0) 100%);
        }

        .as25-tf-grid {
            display: grid;
            grid-template-columns: 18px 1fr 1fr;
            align-items: center;
            gap: 6px 10px;
        }

        .as25-tf-head {
            text-align: center;
            color: #f25569;
            font-size: 0.7rem;
            font-weight: 800;
        }

        .as25-tf-label {
            color: #334155;
            font-size: 0.8rem;
            font-weight: 800;
            text-align: center;
        }

        .as25-short-input {
            width: 100%;
            margin-top: 8px;
            padding: 6px 10px;
            border: 1.5px solid #ffd2da;
            border-radius: 8px;
            background: #fff7f9;
            color: #e11d48;
            font-size: 1.1rem;
            font-weight: 900;
            text-align: center;
            letter-spacing: 0.2em;
            outline: none;
            transition: border-color 120ms ease, box-shadow 120ms ease;
            box-sizing: border-box;
        }

        .as25-short-input:focus {
            border-color: #fb7185;
            box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.14);
        }

        .as25-short-input:disabled {
            opacity: 0.7;
            cursor: default;
        }

        .as25-sa-visual {
            display: flex;
            justify-content: center;
            gap: 6px;
            margin-top: 10px;
            overflow-x: auto;
            padding-bottom: 2px;
        }

        .as25-sa-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 20px;
        }

        .as25-sa-row {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        }

        .as25-sa-row-label {
            color: #64748b;
            font-size: 0.6rem;
            font-weight: 800;
            line-height: 1;
        }

        @media (max-width: 768px) {
            .as25-section-shell {
                padding: 10px;
                border-radius: 12px;
            }

            .as25-panel-grid {
                grid-template-columns: 1fr;
                gap: 8px;
            }

            .as25-panel-grid--short {
                grid-template-columns: 1fr 1fr;
                gap: 6px;
            }

            .as25-card--mc,
            .as25-card--tf,
            .as25-card--sa {
                padding: 10px;
                border-radius: 12px;
            }

            .as25-bubble {
                width: 22px;
                height: 22px;
            }

            .as25-bubble--mini {
                width: 16px;
                height: 16px;
            }

            .as25-mc-grid {
                gap: 6px;
            }

            .as25-card-title {
                font-size: 1.05rem;
            }

            .as25-short-input {
                font-size: 1.05rem;
                letter-spacing: 0.15em;
            }
        }
    `;

    return (
        <div className="min-h-full w-full bg-[#fff3f6] px-5 py-6 md:px-8 md:py-8">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-24">
                {part1Questions.length > 0 && (
                    <SectionPanel
                        label="PHẦN I"
                    >
                        <div className="as25-panel-grid">
                            {part1Groups.map((group, groupIndex) => (
                                <div key={`part1-group-${groupIndex}`} className="as25-card as25-card--mc">
                                    <div className="as25-mc-grid">
                                        <div />
                                        {CHOICE_LABELS.map((label) => (
                                            <div key={`part1-head-${groupIndex}-${label}`} className="as25-mc-label">
                                                {label}
                                            </div>
                                        ))}

                                        {group.map((question, localIndex) => {
                                            const questionNumber = (groupIndex * 10) + localIndex + 1;
                                            const questionKey = getQuestionKey(part1Id, question.id);
                                            const currentValue = answers[questionKey];
                                            const isAnswered = currentValue !== undefined && currentValue !== null && currentValue !== '';

                                            return (
                                                <React.Fragment key={questionKey}>
                                                    <div className={`as25-qno ${isAnswered ? 'is-answered' : ''}`}>
                                                        {questionNumber}
                                                    </div>

                                                    {CHOICE_LABELS.map((label, choiceIndex) => (
                                                        <button
                                                            key={`${questionKey}-${label}`}
                                                            type="button"
                                                            className={`as25-bubble ${currentValue === choiceIndex ? 'is-filled' : ''}`}
                                                            onClick={() => {
                                                                if (readOnly) return;
                                                                handleAnswerChange(questionKey, choiceIndex);
                                                            }}
                                                            disabled={readOnly}
                                                            aria-label={`Câu ${questionNumber} chọn ${label}`}
                                                        />
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionPanel>
                )}

                {part2Questions.length > 0 && (
                    <SectionPanel
                        label="PHẦN II"
                    >
                        <div className="as25-panel-grid">
                            {part2Questions.map((question, questionIndex) => {
                                const questionKey = getQuestionKey(part2Id, question.id);
                                const currentAnswers = answers[questionKey] || {};

                                return (
                                    <div key={questionKey} className="as25-card as25-card--tf">
                                        <div className="as25-card-title">Câu {questionIndex + 1}</div>
                                        <div className="as25-card-divider" />

                                        <div className="as25-tf-grid">
                                            <div />
                                            <div className="as25-tf-head">Đúng</div>
                                            <div className="as25-tf-head">Sai</div>

                                            {TRUE_FALSE_LABELS.map((label, statementIndex) => {
                                                const statementId = getStatementId(question?.statements?.[statementIndex], statementIndex);
                                                const selectedValue = currentAnswers[statementId];
                                                const isAnswered = selectedValue !== undefined;

                                                return (
                                                    <React.Fragment key={`${questionKey}-${label}`}>
                                                        <div className={`as25-tf-label ${isAnswered ? 'is-answered' : ''}`}>
                                                            {label})
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className={`as25-bubble ${selectedValue === true ? 'is-filled' : ''}`}
                                                            onClick={() => {
                                                                if (readOnly) return;
                                                                handleAnswerChange(questionKey, true, statementId);
                                                            }}
                                                            disabled={readOnly}
                                                            aria-label={`Câu ${questionIndex + 1} ý ${label} chọn đúng`}
                                                        />

                                                        <button
                                                            type="button"
                                                            className={`as25-bubble ${selectedValue === false ? 'is-filled' : ''}`}
                                                            onClick={() => {
                                                                if (readOnly) return;
                                                                handleAnswerChange(questionKey, false, statementId);
                                                            }}
                                                            disabled={readOnly}
                                                            aria-label={`Câu ${questionIndex + 1} ý ${label} chọn sai`}
                                                        />
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionPanel>
                )}

                {part3Questions.length > 0 && (
                    <SectionPanel
                        label="PHẦN III"
                    >
                        <div className="as25-panel-grid as25-panel-grid--short">
                            {part3Questions.map((question, questionIndex) => {
                                const questionKey = getQuestionKey(part3Id, question.id);
                                const normalizedValue = normalizeShortAnswerValue(answers[questionKey]);
                                const slots = Array.from({ length: SHORT_ANSWER_SLOT_COUNT }, (_, slotIndex) => normalizedValue[slotIndex] || '');
                                const isAnswered = normalizedValue.length > 0;

                                return (
                                    <div key={questionKey} className="as25-card as25-card--sa">
                                        <div className={`as25-card-title as25-sa-title ${isAnswered ? 'is-answered' : ''}`}>
                                            Câu {questionIndex + 1}
                                        </div>

                                        <input
                                            disabled={readOnly}
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            maxLength={SHORT_ANSWER_SLOT_COUNT}
                                            placeholder="Ví dụ: -4,5"
                                            value={normalizedValue}
                                            onChange={(event) => {
                                                if (readOnly) return;
                                                handleAnswerChange(questionKey, normalizeShortAnswerValue(event.target.value));
                                            }}
                                            className="as25-short-input"
                                        />

                                        <div className="as25-sa-visual">
                                            {Array.from({ length: SHORT_ANSWER_SLOT_COUNT }).map((_, slotIndex) => (
                                                <div key={`${questionKey}-slot-${slotIndex}`} className="as25-sa-column">
                                                    {SHORT_ANSWER_ROWS.map((label) => {
                                                        const isSelected = slots[slotIndex] === label;

                                                        return (
                                                            <div key={`${questionKey}-${slotIndex}-${label}`} className="as25-sa-row">
                                                                <span className="as25-sa-row-label">{label}</span>
                                                                <button
                                                                    type="button"
                                                                    className={`as25-bubble as25-bubble--mini ${isSelected ? 'is-filled' : ''}`}
                                                                    onClick={() => {
                                                                        if (readOnly) return;

                                                                        const nextSlots = [...slots];
                                                                        nextSlots[slotIndex] = nextSlots[slotIndex] === label ? '' : label;
                                                                        handleAnswerChange(questionKey, nextSlots.join(''));
                                                                    }}
                                                                    disabled={readOnly}
                                                                    aria-label={`Câu ${questionIndex + 1} cột ${slotIndex + 1} chọn ${label}`}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionPanel>
                )}
            </div>
        </div>
    );
}
